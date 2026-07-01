"""
Webhook router — simulates Twilio inbound SMS/WhatsApp webhooks
and provides the internal weather-engine alert push endpoint.
"""
import hashlib
import hmac
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Form, Header, HTTPException, Request, Depends, status
from pydantic import BaseModel

from config import settings
from db import get_async_db
from services.translation_service import TranslationService
from services.intent_parser import IntentParser
from services.notification_service import NotificationService

logger = logging.getLogger("webhook_route")
router = APIRouter(prefix="/api/v1/webhook", tags=["Webhooks"])

# Shared service instances
translation_service = TranslationService()
intent_parser = IntentParser()
notification_service = NotificationService()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _verify_twilio_signature(
    request_url: str, post_vars: dict, signature: str, auth_token: str
) -> bool:
    """
    Validates a Twilio request signature (HMAC-SHA1).
    https://www.twilio.com/docs/usage/webhooks/webhooks-security
    """
    try:
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(auth_token)
        return validator.validate(request_url, post_vars, signature)
    except Exception as e:
        logger.warning(f"Twilio signature validation error: {e}")
        return False


def _verify_weather_secret(x_secret: Optional[str]) -> bool:
    """
    Validates the shared HMAC secret from Member B's weather engine.
    Skips validation if WEATHER_ENGINE_SECRET is not configured (demo mode).
    """
    if not settings.WEATHER_ENGINE_SECRET:
        logger.warning(
            "[Weather Push] WEATHER_ENGINE_SECRET not configured — skipping auth (demo mode)."
        )
        return True
    if not x_secret:
        return False
    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(x_secret, settings.WEATHER_ENGINE_SECRET)


async def _process_inbound_message(
    *,
    from_number: str,
    body: str,
    language_code: str,
    source: str,
    db,
) -> dict:
    """
    Shared pipeline for inbound webhook messages (SMS / WhatsApp).
    Steps: detect language → translate → parse intent → store → notify.
    """
    # Auto-detect language if not provided
    if language_code.lower() == "auto" or not language_code:
        detected = translation_service.detect_language(body)
        language_code = f"{detected}-IN"
        logger.info(f"Auto-detected language: {language_code}")

    lang_prefix = language_code.split("-")[0]

    # Translate to English
    english_text = (
        translation_service.translate_to_english(body, source_language=lang_prefix)
        if lang_prefix != "en"
        else body
    )

    # Parse intent
    parsed_intent = await intent_parser.parse_intent(english_text)

    # Store ticket
    ticket_id = str(uuid.uuid4())
    ticket_data = {
        "ticket_id": ticket_id,
        "farmer_id": from_number,   # phone acts as farmer ID for inbound webhooks
        "phone_number": from_number,
        "language_code": language_code,
        "source": source,
        "original_transcript": body,
        "english_transcript": english_text,
        "parsed_intent": parsed_intent,
        "created_at": datetime.utcnow().isoformat(),
        "status": "OPEN",
    }
    await db.collection("tickets").document(ticket_id).set(ticket_data)
    logger.info(f"Inbound webhook ticket {ticket_id} stored. source={source}")

    # Build localized acknowledgment reply
    severity = parsed_intent.get("severity", "low")
    severity_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(severity, "⚪")
    raw_reply = (
        f"Kisan Alert {severity_emoji}: Received your report about "
        f"'{parsed_intent.get('reported_problem')}'. "
        f"Advisory type: {parsed_intent.get('advisory_type')}. "
        f"Ref: {ticket_id[:8].upper()}"
    )
    localized_reply = (
        translation_service.translate_from_english(raw_reply, target_language=lang_prefix)
        if lang_prefix != "en"
        else raw_reply
    )

    # Send acknowledgment back to farmer
    await notification_service.send_alert_bundle(
        phone_number=from_number,
        message=localized_reply,
        channels=["sms", "whatsapp"],
    )

    return {
        "status": "processed",
        "ticket_id": ticket_id,
        "source": source,
        "from": from_number,
        "original_body": body,
        "english_text": english_text,
        "parsed_intent": parsed_intent,
        "reply_sent": localized_reply,
    }


# ─── Inbound SMS webhook ──────────────────────────────────────────────────────

@router.post("/twilio/sms", status_code=status.HTTP_200_OK)
async def twilio_sms_webhook(
    request: Request,
    From: str = Form(..., description="Sender phone number (Twilio field)"),
    Body: str = Form(..., description="SMS body text"),
    language_code: str = Form("auto", description="Language code or 'auto' to detect"),
    x_twilio_signature: Optional[str] = Header(None, alias="X-Twilio-Signature"),
    db=Depends(get_async_db),
):
    """
    Twilio inbound SMS webhook.
    Twilio sends POST form data with fields: From, To, Body, etc.
    Set your Twilio SMS webhook URL to: POST /api/v1/webhook/twilio/sms
    """
    logger.info(f"[Inbound SMS] From: {From} | Body: {Body[:60]}")

    # Validate Twilio signature only when real credentials are present
    if settings.TWILIO_AUTH_TOKEN and x_twilio_signature:
        request_url = str(request.url)
        form_data = dict(await request.form())
        if not _verify_twilio_signature(
            request_url, form_data, x_twilio_signature, settings.TWILIO_AUTH_TOKEN
        ):
            logger.warning("[Inbound SMS] Invalid Twilio signature — rejecting request.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Twilio request signature.",
            )

    result = await _process_inbound_message(
        from_number=From,
        body=Body,
        language_code=language_code,
        source="webhook_sms",
        db=db,
    )
    return result


# ─── Inbound WhatsApp webhook ─────────────────────────────────────────────────

@router.post("/twilio/whatsapp", status_code=status.HTTP_200_OK)
async def twilio_whatsapp_webhook(
    request: Request,
    From: str = Form(..., description="Sender WhatsApp number (whatsapp:+91...)"),
    Body: str = Form(..., description="WhatsApp message body"),
    language_code: str = Form("auto", description="Language code or 'auto' to detect"),
    x_twilio_signature: Optional[str] = Header(None, alias="X-Twilio-Signature"),
    db=Depends(get_async_db),
):
    """
    Twilio inbound WhatsApp webhook.
    Set your Twilio WhatsApp sandbox webhook URL to: POST /api/v1/webhook/twilio/whatsapp
    """
    # Strip the "whatsapp:" prefix Twilio adds to From
    clean_from = From.replace("whatsapp:", "")
    logger.info(f"[Inbound WhatsApp] From: {clean_from} | Body: {Body[:60]}")

    # Validate Twilio signature when real credentials are present
    if settings.TWILIO_AUTH_TOKEN and x_twilio_signature:
        request_url = str(request.url)
        form_data = dict(await request.form())
        if not _verify_twilio_signature(
            request_url, form_data, x_twilio_signature, settings.TWILIO_AUTH_TOKEN
        ):
            logger.warning("[Inbound WhatsApp] Invalid Twilio signature — rejecting.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Twilio request signature.",
            )

    result = await _process_inbound_message(
        from_number=clean_from,
        body=Body,
        language_code=language_code,
        source="webhook_whatsapp",
        db=db,
    )
    return result


# ─── Internal weather engine alert push endpoint ──────────────────────────────

class AlertPushRequest(BaseModel):
    farmer_id: str
    phone_number: str
    language_code: str = "hi-IN"
    alert_type: str     # e.g. "dry_spell", "flood_warning", "frost_alert", "heat_wave"
    message: str        # English alert message from weather engine
    severity: str = "medium"   # low | medium | high
    channels: list = ["sms", "whatsapp", "voice"]


@router.post("/alert/push", status_code=status.HTTP_200_OK)
async def push_weather_alert(
    payload: AlertPushRequest,
    x_secret: Optional[str] = Header(None, alias="X-Weather-Secret"),
    db=Depends(get_async_db),
):
    """
    Internal endpoint for Member B's weather engine to push dry-spell warnings,
    flood alerts, frost warnings, etc. to farmers.

    Authentication: Set X-Weather-Secret header to match WEATHER_ENGINE_SECRET in .env.
    In demo mode (no secret configured), authentication is skipped.
    """
    # Authenticate the weather engine caller
    if not _verify_weather_secret(x_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Weather-Secret header.",
        )

    logger.info(
        f"[Weather Alert Push] type={payload.alert_type} | farmer={payload.farmer_id} | "
        f"severity={payload.severity}"
    )

    lang_prefix = payload.language_code.split("-")[0]

    # Translate the English alert message to the farmer's language
    alert_type_labels = {
        "dry_spell": "Dry Spell Warning",
        "flood_warning": "Flood Warning",
        "frost_alert": "Frost Alert",
        "heat_wave": "Heat Wave Alert",
        "heavy_rain": "Heavy Rain Advisory",
        "hail_storm": "Hailstorm Warning",
        "cyclone": "Cyclone Advisory",
    }
    alert_label = alert_type_labels.get(payload.alert_type, payload.alert_type.replace("_", " ").title())
    severity_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(payload.severity, "⚪")

    full_english_msg = (
        f"Kisan Alert {severity_emoji} [{alert_label}]: {payload.message} "
        f"— Please take necessary precautions for your crops."
    )

    # Localize message
    localized_msg = (
        translation_service.translate_from_english(full_english_msg, target_language=lang_prefix)
        if lang_prefix != "en"
        else full_english_msg
    )

    # Log the weather alert to Firestore
    alert_id = str(uuid.uuid4())
    alert_data = {
        "alert_id": alert_id,
        "farmer_id": payload.farmer_id,
        "phone_number": payload.phone_number,
        "alert_type": payload.alert_type,
        "severity": payload.severity,
        "english_message": full_english_msg,
        "localized_message": localized_msg,
        "language_code": payload.language_code,
        "channels": payload.channels,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.collection("weather_alerts").document(alert_id).set(alert_data)
    logger.info(f"Weather alert {alert_id} stored in Firestore.")

    # Dispatch to all requested channels
    delivery_report = await notification_service.send_alert_bundle(
        phone_number=payload.phone_number,
        message=localized_msg,
        channels=payload.channels,
    )

    return {
        "status": "dispatched",
        "alert_id": alert_id,
        "farmer_id": payload.farmer_id,
        "alert_type": payload.alert_type,
        "severity": payload.severity,
        "localized_message": localized_msg,
        "delivery_report": delivery_report,
    }
