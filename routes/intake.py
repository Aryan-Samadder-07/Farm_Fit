import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from pydantic import BaseModel

from db import get_async_db
from services.speech_service import SpeechService
from services.translation_service import TranslationService
from services.intent_parser import IntentParser
from services.notification_service import NotificationService

logger = logging.getLogger("intake_route")
router = APIRouter(prefix="/api/v1/intake", tags=["Intake"])

# Shared service instances
speech_service = SpeechService()
translation_service = TranslationService()
intent_parser = IntentParser()
notification_service = NotificationService()


# ─── Response Model ───────────────────────────────────────────────────────────

class PipelineResult(BaseModel):
    status: str
    ticket_id: str
    source: str                     # "voice" | "text" | "webhook_sms" | "webhook_whatsapp"
    language_code: str
    original_transcript: str
    english_transcript: str
    parsed_intent: dict
    notification_sent: str
    delivery_report: Optional[dict] = None


# ─── Shared pipeline logic ────────────────────────────────────────────────────

async def _run_pipeline(
    *,
    native_text: str,
    farmer_id: str,
    phone_number: str,
    language_code: str,
    source: str,
    db,
) -> dict:
    """
    Core processing pipeline shared by all intake endpoints.
    Steps: translate → parse intent → store → notify → return result.
    """
    lang_prefix = language_code.split("-")[0]

    # Translate to English
    if lang_prefix != "en":
        english_transcript = translation_service.translate_to_english(
            text=native_text, source_language=lang_prefix
        )
    else:
        english_transcript = native_text

    # Parse intent with Gemini 1.5 Flash
    parsed_intent = await intent_parser.parse_intent(english_transcript)

    # Build and store ticket
    ticket_id = str(uuid.uuid4())
    ticket_data = {
        "ticket_id": ticket_id,
        "farmer_id": farmer_id,
        "phone_number": phone_number,
        "language_code": language_code,
        "source": source,
        "original_transcript": native_text,
        "english_transcript": english_transcript,
        "parsed_intent": parsed_intent,
        "created_at": datetime.utcnow().isoformat(),
        "status": "OPEN",
    }
    await db.collection("tickets").document(ticket_id).set(ticket_data)
    logger.info(f"Ticket {ticket_id} stored. source={source}, farmer={farmer_id}")

    # Generate and localize the outbound advisory message
    severity = parsed_intent.get("severity", "low")
    severity_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(severity, "⚪")

    raw_msg = (
        f"Kisan Alert {severity_emoji}: Your report on "
        f"'{parsed_intent.get('reported_problem')}' for {parsed_intent.get('crop_type')} "
        f"has been logged (Ticket: {ticket_id[:8].upper()}). "
        f"Advisory type: {parsed_intent.get('advisory_type', 'pending')}."
    )

    if lang_prefix != "en":
        localized_msg = translation_service.translate_from_english(
            text=raw_msg, target_language=lang_prefix
        )
    else:
        localized_msg = raw_msg

    # Dispatch notifications (SMS + WhatsApp for all intakes)
    delivery_report = await notification_service.send_alert_bundle(
        phone_number=phone_number,
        message=localized_msg,
        channels=["sms", "whatsapp"],
    )

    return {
        "status": "success",
        "ticket_id": ticket_id,
        "source": source,
        "language_code": language_code,
        "original_transcript": native_text,
        "english_transcript": english_transcript,
        "parsed_intent": parsed_intent,
        "notification_sent": localized_msg,
        "delivery_report": delivery_report,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/health", tags=["Intake"])
async def health_check():
    """Quick health check endpoint for the intake pipeline services."""
    return {
        "service": "Kisan Alert — Intake Pipeline",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "services": {
            "speech": "mock" if not speech_service.client else "real",
            "translation": "mock" if not translation_service.client else "real",
            "intent_parser": "mock" if not intent_parser.client else "real (gemini-1.5-flash)",
            "notifications": "mock" if not notification_service.twilio_client else "real (twilio)",
        },
    }


@router.post("/voice", status_code=status.HTTP_201_CREATED, response_model=PipelineResult)
async def intake_voice(
    file: UploadFile = File(..., description="Audio file in WAV, FLAC, or OGG-Opus format"),
    farmer_id: str = Form(..., description="Unique ID of the farmer"),
    phone_number: str = Form(..., description="Farmer's phone number for alerts"),
    language_code: str = Form(
        "hi-IN",
        description="BCP-47 language code of the recording (e.g. hi-IN, te-IN, ta-IN, kn-IN, bn-IN)",
    ),
    db=Depends(get_async_db),
):
    """
    Voice intake endpoint: accepts an audio upload and runs the full
    Speech-to-Text → Translation → Gemini Intent Parsing → Storage → Notification pipeline.
    """
    logger.info(f"[Voice Intake] farmer={farmer_id} | lang={language_code}")
    try:
        audio_content = await file.read()
        if not audio_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty audio file uploaded.",
            )

        # Step 1: Speech-to-Text
        native_transcript = await speech_service.transcribe_audio(
            audio_bytes=audio_content, language_code=language_code
        )

        # Steps 2–5: Shared pipeline
        result = await _run_pipeline(
            native_text=native_transcript,
            farmer_id=farmer_id,
            phone_number=phone_number,
            language_code=language_code,
            source="voice",
            db=db,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in voice intake pipeline")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice intake pipeline failed: {str(e)}",
        )


@router.post("/text", status_code=status.HTTP_201_CREATED, response_model=PipelineResult)
async def intake_text(
    text: str = Form(..., description="Farmer's raw message text in their native language"),
    farmer_id: str = Form(..., description="Unique ID of the farmer"),
    phone_number: str = Form(..., description="Farmer's phone number for alerts"),
    language_code: str = Form(
        "hi-IN",
        description="BCP-47 language code of the text (e.g. hi-IN). Use 'auto' to auto-detect.",
    ),
    db=Depends(get_async_db),
):
    """
    Text intake endpoint: accepts a raw text message (e.g. from SMS/WhatsApp)
    and runs the Translation → Gemini Intent Parsing → Storage → Notification pipeline.
    Skips the Speech-to-Text step.
    """
    logger.info(f"[Text Intake] farmer={farmer_id} | lang={language_code}")
    try:
        if not text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty text submitted.",
            )

        # Auto-detect language if requested
        effective_lang = language_code
        if language_code.lower() == "auto":
            detected_prefix = translation_service.detect_language(text)
            effective_lang = f"{detected_prefix}-IN"
            logger.info(f"Auto-detected language: {effective_lang}")

        result = await _run_pipeline(
            native_text=text,
            farmer_id=farmer_id,
            phone_number=phone_number,
            language_code=effective_lang,
            source="text",
            db=db,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in text intake pipeline")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Text intake pipeline failed: {str(e)}",
        )


@router.post("/preprocess-diagnose", status_code=status.HTTP_201_CREATED)
async def preprocess_diagnose(
    voice: Optional[UploadFile] = File(None, description="Audio file in WAV, FLAC, or OGG-Opus format"),
    text: Optional[str] = Form(None, description="Farmer's raw text description"),
    images: List[UploadFile] = File([], description="Up to 3 leaf/crop images"),
    farmer_name: str = Form("Anonymous Farmer"),
    crop_type: str = Form("Unknown"),
    phone_number: Optional[str] = Form(None),
    village_name: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    db=Depends(get_async_db)
):
    """
    Multimodal intake preprocessing endpoint. Accepts optional voice or text inputs,
    and optional crop images with farmer metadata.
    Automatically detects spoken language or text language, converts voice to text,
    translates transcripts to English, and forwards the standardized query directly
    to the Disease Intelligence API (via standard diagnosis endpoint or service).
    Does NOT run AI diagnosis locally.
    """
    try:
        # Determine the raw transcript text
        raw_transcript = ""
        detected_lang = "hi-IN" # Default fallback
        
        if voice:
            audio_content = await voice.read()
            if audio_content:
                # Transcribe voice to get native text
                raw_transcript = await speech_service.transcribe_audio(
                    audio_bytes=audio_content, language_code=detected_lang
                )
                # Auto-detect language prefix
                detected_prefix = translation_service.detect_language(raw_transcript)
                detected_lang = f"{detected_prefix}-IN"
        elif text:
            raw_transcript = text
            # Auto-detect language prefix
            detected_prefix = translation_service.detect_language(raw_transcript)
            detected_lang = f"{detected_prefix}-IN"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either voice recording or text description must be provided."
            )

        lang_prefix = detected_lang.split("-")[0]
        
        # Translate to English
        english_transcript = raw_transcript
        if lang_prefix != "en":
            english_transcript = translation_service.translate_to_english(
                text=raw_transcript, source_language=lang_prefix
            )

        # Standardize the request and route to the Disease Intelligence API (via DiagnosisService)
        # Note: Do not perform AI diagnosis locally - we delegate the actual diagnosis to standard DiagnosisService.
        from services.diagnosis_service import DiagnosisService
        diagnosis_srv = DiagnosisService()
        
        # Read and prepare image payloads
        images_payload = []
        for img in images:
            img_bytes = await img.read()
            mime_type = img.content_type or "image/jpeg"
            images_payload.append((img_bytes, mime_type))
            
        # Call the actual AI Diagnosis Service
        diag_result = await diagnosis_srv.diagnose_crop(
            images_list=images_payload,
            problem_transcript=english_transcript
        )
        
        # Map crop type using scientific diagnosis first-word fallback if unspecified
        inferred_crop = crop_type
        if inferred_crop == "Unknown" and diag_result.disease_name:
            inferred_crop = diag_result.disease_name.split()[0]
            
        # Store ticket in Firestore (as standard API behavior)
        import base64
        images_base64 = []
        for img_bytes, mime_type in images_payload:
            encoded_str = base64.b64encode(img_bytes).decode("utf-8")
            images_base64.append(f"data:{mime_type};base64,{encoded_str}")
            
        ticket_payload = {
            "farmer_name": farmer_name,
            "crop_type": inferred_crop,
            "problem_transcript": english_transcript,
            "original_transcript": raw_transcript,
            "language_code": detected_lang,
            "disease_name": diag_result.disease_name,
            "confidence": diag_result.confidence,
            "severity_level": diag_result.severity_level,
            "actionable_steps": diag_result.actionable_steps,
            "requires_expert": diag_result.requires_expert,
            "status": "PENDING",
            "images": images_base64,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }
        if phone_number:
            ticket_payload["phone_number"] = phone_number
        if village_name:
            ticket_payload["village_name"] = village_name
        if latitude is not None:
            ticket_payload["latitude"] = latitude
        if longitude is not None:
            ticket_payload["longitude"] = longitude
            
        # Store in Firestore collection
        ticket_ref = db.collection("tickets").document()
        await ticket_ref.set(ticket_payload)
        
        return {
            "status": "success",
            "ticket_id": ticket_ref.id,
            "original_transcript": raw_transcript,
            "english_transcript": english_transcript,
            "language_detected": detected_lang,
            "diagnosis": {
                "disease_name": diag_result.disease_name,
                "confidence": diag_result.confidence,
                "severity_level": diag_result.severity_level,
                "actionable_steps": diag_result.actionable_steps,
                "requires_expert": diag_result.requires_expert
            }
        }
    except Exception as e:
        logger.exception("Error in intake preprocess-diagnose endpoint")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preprocessing and routing failed: {str(e)}"
        )
