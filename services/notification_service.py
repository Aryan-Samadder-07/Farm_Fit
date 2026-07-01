from google.cloud import firestore
from typing import List, Dict, Any, Optional
from collections import deque
from db import get_db

# Module-level ring-buffer for the outbound alert log (polled by /api/v1/alerts/log)
OUTBOUND_LOG: deque = deque(maxlen=200)


class NotificationService:
    def __init__(self, db: firestore.Client | None = None):
        self.db = db or get_db()

        # Twilio client — only initialised when real credentials are present
        self.twilio_client = None
        try:
            from config import settings
            if (
                settings.TWILIO_ACCOUNT_SID
                and settings.TWILIO_AUTH_TOKEN
            ):
                from twilio.rest import Client as TwilioClient
                self.twilio_client = TwilioClient(
                    settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN
                )
        except Exception:
            pass  # Twilio not installed or creds missing — mock mode

    # ── Existing notification-queue methods (Aryan's code — untouched) ────────

    async def get_notifications(self, limit: int = 50, unread_only: bool = False) -> List[Dict[str, Any]]:
        """
        Fetches system alerts from the Firestore 'alerts' collection.
        Optionally filters for undelivered (unread) alerts only.
        """
        ref = self.db.collection("alerts").order_by(
            "created_at", direction=firestore.Query.DESCENDING
        ).limit(limit)

        docs = ref.stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            if unread_only and data.get("delivered", False):
                continue
            results.append({
                "id": doc.id,
                "type": data.get("type", "INFO"),
                "title": data.get("title", "System Alert"),
                "message": data.get("message", ""),
                "severity": data.get("severity", "INFO"),
                "created_at": str(data.get("created_at", "")),
                "delivered": data.get("delivered", False)
            })

        # Fallback demo notifications if collection is empty
        if not results:
            results = self._demo_notifications()

        return results

    async def mark_delivered(self, alert_id: str) -> bool:
        """Marks a single alert as read/delivered."""
        try:
            self.db.collection("alerts").document(alert_id).update({"delivered": True})
            return True
        except Exception:
            return False

    async def mark_all_delivered(self) -> int:
        """Marks all undelivered alerts as read. Returns count marked."""
        docs = self.db.collection("alerts").where("delivered", "==", False).stream()
        count = 0
        for doc in docs:
            doc.reference.update({"delivered": True})
            count += 1
        return count

    def _demo_notifications(self) -> List[Dict[str, Any]]:
        from datetime import datetime, timedelta
        now = datetime.now()
        return [
            {
                "id": "demo_1",
                "type": "OUTBREAK_WARNING",
                "title": "Crop Outbreak Alert: Late Blight in SPSR Nellore",
                "message": "6 farmers reported Late Blight on Tomato within 5km in Podalakur Mandal. Immediate expert action required.",
                "severity": "CRITICAL",
                "created_at": (now - timedelta(minutes=12)).isoformat(),
                "delivered": False
            },
            {
                "id": "demo_2",
                "type": "WEATHER_ALERT",
                "title": "Dry Spell Warning: Nellore Region",
                "message": "No rainfall recorded for 14 consecutive days. Irrigation advisory recommended for Rabi crops.",
                "severity": "HIGH",
                "created_at": (now - timedelta(hours=2)).isoformat(),
                "delivered": False
            },
            {
                "id": "demo_3",
                "type": "EXPERT_OUTBREAK_REGISTERED",
                "title": "Expert-Confirmed Outbreak: Rice Blast",
                "message": "Field officer confirmed Rice Blast in Indukurpet Mandal. 4 farmers affected.",
                "severity": "CRITICAL",
                "created_at": (now - timedelta(hours=5)).isoformat(),
                "delivered": True
            },
            {
                "id": "demo_4",
                "type": "SYSTEM",
                "title": "Scheduled Weather Poll Completed",
                "message": "Open-Meteo weather ingestion completed for 12 monitored districts. All data current.",
                "severity": "INFO",
                "created_at": (now - timedelta(hours=8)).isoformat(),
                "delivered": True
            }
        ]

    # ── New outbound alert dispatch (Ayush's code) ────────────────────────────

    async def send_alert_bundle(
        self,
        *,
        phone_number: str,
        message: str,
        channels: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Dispatches an alert to one or more channels (sms, whatsapp).
        Uses Twilio when credentials are configured; otherwise logs a mock delivery.
        Results are appended to the module-level OUTBOUND_LOG for the alerts endpoint.
        """
        from datetime import datetime
        from config import settings

        if channels is None:
            channels = ["sms"]

        delivery_report: Dict[str, Any] = {}

        for channel in channels:
            entry = {
                "channel": channel,
                "to": phone_number,
                "message": message[:160],
                "timestamp": datetime.utcnow().isoformat(),
            }

            if self.twilio_client:
                try:
                    if channel == "sms":
                        msg = self.twilio_client.messages.create(
                            body=message,
                            from_=settings.TWILIO_FROM_NUMBER,
                            to=phone_number,
                        )
                        entry["status"] = "sent"
                        entry["sid"] = msg.sid

                    elif channel == "whatsapp":
                        from_wa = (
                            f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}"
                            if not settings.TWILIO_WHATSAPP_NUMBER.startswith("whatsapp:")
                            else settings.TWILIO_WHATSAPP_NUMBER
                        )
                        to_wa = (
                            f"whatsapp:{phone_number}"
                            if not phone_number.startswith("whatsapp:")
                            else phone_number
                        )
                        msg = self.twilio_client.messages.create(
                            body=message,
                            from_=from_wa,
                            to=to_wa,
                        )
                        entry["status"] = "sent"
                        entry["sid"] = msg.sid

                    else:
                        # Unknown channel — log but skip
                        entry["status"] = "skipped"

                except Exception as exc:
                    entry["status"] = "error"
                    entry["error"] = str(exc)
            else:
                # Mock mode — simulate delivery
                entry["status"] = "mock_delivered"
                entry["note"] = "Twilio credentials not configured. Running in mock mode."

            delivery_report[channel] = entry
            OUTBOUND_LOG.appendleft(entry)

        return delivery_report
