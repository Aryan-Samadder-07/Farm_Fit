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
        from_queue: bool = False,
        simulate_offline: bool = False,
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
        failed_channels = []

        for channel in channels:
            entry = {
                "channel": channel,
                "to": phone_number,
                "message": message[:160],
                "timestamp": datetime.utcnow().isoformat(),
            }

            if simulate_offline:
                entry["status"] = "error"
                entry["error"] = "Offline simulation error"
                failed_channels.append(channel)
            elif self.twilio_client:
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
                    failed_channels.append(channel)
            else:
                # Mock mode — simulate delivery
                entry["status"] = "mock_delivered"
                entry["note"] = "Twilio credentials not configured. Running in mock mode."

            delivery_report[channel] = entry
            OUTBOUND_LOG.appendleft(entry)

        # If any real delivery failed and not already calling from offline queue processor
        if failed_channels and not from_queue:
            try:
                queue_ref = self.db.collection("offline_queue").document()
                queue_ref.set({
                    "phone_number": phone_number,
                    "message": message,
                    "channels": failed_channels,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "retry_count": 0,
                    "status": "PENDING"
                })
            except Exception as queue_err:
                # Log queue storage error but do not block execution
                print(f"[Offline Queue] Failed to store pending notification: {queue_err}")

        return delivery_report

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        import math
        R = 6371.0  # Earth's radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    async def notify_farmers_in_radius(
        self,
        *,
        disease_name: str,
        affected_area: str,
        severity_level: str,
        precautions: str,
        latitude: float,
        longitude: float,
        radius_km: float = 5.0,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all registered farmers, checks geo-fenced distance,
        and sends alerts via SMS, WhatsApp, and push notifications.
        """
        from datetime import datetime
        from services.translation_service import TranslationService
        translator = TranslationService()
        
        farmers_ref = self.db.collection("farmers")
        farmers_docs = farmers_ref.stream()
        
        alerts_sent = []
        
        for doc in farmers_docs:
            farmer_data = doc.to_dict()
            phone_number = farmer_data.get("phone_number")
            if not phone_number:
                continue
            
            # Fetch farmer coordinates
            f_lat = farmer_data.get("latitude")
            f_lon = farmer_data.get("longitude")
            
            # Fallbacks for coordinates if missing
            if f_lat is None or f_lon is None:
                village = farmer_data.get("village_name", "").lower()
                if "podalakur" in village:
                    f_lat, f_lon = 14.4625, 79.9912
                elif "indukurpet" in village:
                    f_lat, f_lon = 14.4215, 79.9654
                else:
                    # Look up latest ticket for this phone
                    tickets = self.db.collection("tickets").where("phone_number", "==", phone_number).limit(1).stream()
                    ticket_found = False
                    for t in tickets:
                        td = t.to_dict()
                        if td.get("latitude") is not None:
                            f_lat = td.get("latitude")
                            f_lon = td.get("longitude")
                            ticket_found = True
                            break
                    if not ticket_found:
                        f_lat, f_lon = 14.44, 79.98

            # Compute distance
            dist = self._haversine_distance(latitude, longitude, f_lat, f_lon)
            if dist <= radius_km:
                lang = farmer_data.get("language_code", "hi-IN")
                lang_prefix = lang.split("-")[0]
                
                raw_message = (
                    f"🚨 EMERGENCY ALERT: Outbreak of {disease_name} in {affected_area}. "
                    f"Severity: {severity_level}. "
                    f"Precautions: {precautions}."
                )
                
                localized_msg = raw_message
                if lang_prefix != "en":
                    localized_msg = translator.translate_from_english(raw_message, target_language=lang_prefix)
                
                # Send SMS and WhatsApp
                delivery = await self.send_alert_bundle(
                    phone_number=phone_number,
                    message=localized_msg,
                    channels=["sms", "whatsapp"]
                )
                
                # Store push notification in Firestore
                push_id = f"push_{doc.id}_{int(datetime.utcnow().timestamp())}"
                push_data = {
                    "id": push_id,
                    "farmer_id": doc.id,
                    "phone_number": phone_number,
                    "title": "🚨 Crop Outbreak Alert",
                    "message": localized_msg,
                    "severity": severity_level,
                    "priority": "HIGH",
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "status": "DELIVERED"
                }
                self.db.collection("push_notifications").document(push_id).set(push_data)
                
                # Store in alerts collection
                alert_id = f"alert_{int(datetime.utcnow().timestamp())}_{doc.id[:4]}"
                self.db.collection("alerts").document(alert_id).set({
                    "id": alert_id,
                    "type": "OUTBREAK_WARNING",
                    "title": f"Crop Outbreak Alert: {disease_name}",
                    "message": localized_msg,
                    "severity": severity_level,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "delivered": True
                })
                
                alerts_sent.append({
                    "farmer_id": doc.id,
                    "phone_number": phone_number,
                    "distance_km": round(dist, 2),
                    "delivery": delivery
                })
                
        return alerts_sent

    async def process_offline_queue(self) -> int:
        """
        Scans Firestore 'offline_queue' for PENDING alerts and attempts to retry them.
        """
        from datetime import datetime
        queue_ref = self.db.collection("offline_queue").where("status", "==", "PENDING").stream()
        processed_count = 0
        for doc in queue_ref:
            data = doc.to_dict()
            phone_number = data.get("phone_number")
            message = data.get("message")
            channels = data.get("channels", ["sms"])
            retry_count = data.get("retry_count", 0)
            
            delivery = await self.send_alert_bundle(
                phone_number=phone_number,
                message=message,
                channels=channels,
                from_queue=True
            )
            
            success = any(d.get("status") in ["sent", "mock_delivered"] for d in delivery.values())
            
            if success:
                self.db.collection("offline_queue").document(doc.id).update({
                    "status": "DELIVERED",
                    "delivered_at": datetime.utcnow().isoformat() + "Z"
                })
                processed_count += 1
            else:
                self.db.collection("offline_queue").document(doc.id).update({
                    "retry_count": retry_count + 1,
                    "last_attempt": datetime.utcnow().isoformat() + "Z",
                    "status": "FAILED" if retry_count >= 3 else "PENDING"
                })
        return processed_count
