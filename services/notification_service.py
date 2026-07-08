import datetime
import logging
from typing import List, Dict, Any, Optional
from google.cloud import firestore
from db import get_db
from services.email_service import EmailService

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self, db: firestore.Client | None = None):
        self.db = db or get_db()
        self.email_service = EmailService()

    async def create_notification(
        self,
        type: str,
        title: str,
        message: str,
        severity: str = "INFO",
        recipient_email: str = None,
        ticket_id: str = None,
        email: str = None
    ) -> str:
        """
        Core Notification System:
        Creates a document in Firestore 'alerts' (making it pop up in the Navbar alerts box)
        and sends a rich HTML email alert.
        """
        try:
            # Determine email to save for targeting
            target_email = email or recipient_email

            # 1. Save to Firestore alerts collection
            alert_data = {
                "type": type,
                "title": title,
                "message": message,
                "severity": severity,
                "created_at": datetime.datetime.utcnow().isoformat() + "Z",
                "delivered": False
            }
            if ticket_id:
                alert_data["ticket_id"] = ticket_id
            if target_email:
                alert_data["email"] = target_email
                
            doc_ref = self.db.collection("alerts").document()
            doc_ref.set(alert_data)
            alert_id = doc_ref.id
            logger.info(f"[NotificationService] Alert logged to DB: {alert_id} - {title}")

            # 2. Dispatch email notification
            try:
                self.email_service.send_alert_notification(
                    alert_type=type,
                    title=title,
                    message=message,
                    severity=severity,
                    recipient_email=target_email
                )
            except Exception as email_err:
                logger.error(f"[NotificationService] SMTP Email dispatch failed: {email_err}")

            return alert_id
        except Exception as e:
            logger.error(f"[NotificationService] Failed to create notification: {e}")
            return ""

    async def get_notifications(self, limit: int = 50, unread_only: bool = False, email: str = None) -> List[Dict[str, Any]]:
        """
        Fetches system alerts from the Firestore 'alerts' collection.
        Returns them sorted descending in Python, filtered by email if provided.
        """
        results = []
        try:
            ref = self.db.collection("alerts")
            docs = ref.stream()
            for doc in docs:
                data = doc.to_dict()
                if unread_only and data.get("delivered", False):
                    continue
                
                # Filter by email: show if alert targets this user OR is system-wide (no email targeted)
                alert_email = data.get("email")
                if email and alert_email and alert_email != email:
                    continue
                    
                results.append({
                    "id": doc.id,
                    "type": data.get("type", "INFO"),
                    "title": data.get("title", "System Alert"),
                    "message": data.get("message", ""),
                    "severity": data.get("severity", "INFO"),
                    "created_at": str(data.get("created_at", "")),
                    "delivered": data.get("delivered", False),
                    "ticket_id": data.get("ticket_id"),
                    "email": alert_email
                })
            
            # Programmatic sorting in Python to avoid composite index requirements
            results.sort(key=lambda x: x["created_at"], reverse=True)
            results = results[:limit]
        except Exception as e:
            logger.error(f"[NotificationService] Failed to fetch alerts: {e}")

        return results

    async def mark_delivered(self, alert_id: str) -> bool:
        """Marks a single alert as read/delivered."""
        try:
            self.db.collection("alerts").document(alert_id).update({"delivered": True})
            return True
        except Exception as e:
            logger.error(f"[NotificationService] Mark delivered failed: {e}")
            return False

    async def mark_all_delivered(self) -> int:
        """Marks all undelivered alerts as read. Returns count marked."""
        try:
            docs = self.db.collection("alerts").where("delivered", "==", False).stream()
            count = 0
            for doc in docs:
                doc.reference.update({"delivered": True})
                count += 1
            return count
        except Exception as e:
            logger.error(f"[NotificationService] Mark all delivered failed: {e}")
            return 0

    def _demo_notifications(self) -> List[Dict[str, Any]]:
        now = datetime.datetime.now()
        return [
            {
                "id": "demo_1",
                "type": "OUTBREAK_WARNING",
                "title": "Crop Outbreak Alert: Late Blight in SPSR Nellore",
                "message": "6 farmers reported Late Blight on Tomato within 5km in Podalakur Mandal. Immediate expert action required.",
                "severity": "CRITICAL",
                "created_at": (now - datetime.timedelta(minutes=12)).isoformat(),
                "delivered": False
            },
            {
                "id": "demo_2",
                "type": "WEATHER_ALERT",
                "title": "Dry Spell Warning: Nellore Region",
                "message": "No rainfall recorded for 14 consecutive days. Irrigation advisory recommended for Rabi crops.",
                "severity": "HIGH",
                "created_at": (now - datetime.timedelta(hours=2)).isoformat(),
                "delivered": False
            }
        ]

    # ── Legacy Compatibility Wrappers ────────────────────────────────────────

    async def send_alert_bundle(
        self,
        *,
        phone_number: str,
        message: str,
        channels: List[str] = None,
        from_queue: bool = False,
        simulate_offline: bool = False,
    ) -> Dict[str, Any]:
        """Legacy method wrapper that routes alerts into our core create_notification system."""
        alert_id = await self.create_notification(
            type="SMS_MOCK_DISPATCH",
            title=f"Advisory Message Log to {phone_number}",
            message=message,
            severity="INFO"
        )
        return {
            "sms": {
                "channel": "sms",
                "to": phone_number,
                "message": message[:160],
                "status": "mock_delivered",
                "alert_id": alert_id
            }
        }

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
        """Outbreak radial alerting. Posts a system-wide navbar alert and emails every
        registered farmer whose ticket GPS falls within the outbreak radius."""
        from math import radians, cos, sin, asin, sqrt

        alert_title = f"Crop Outbreak Alert: {disease_name} in {affected_area}"
        alert_msg = (
            f"Outbreak of {disease_name} in {affected_area}. "
            f"Severity: {severity_level}. Precautions: {precautions}."
        )

        # 1. Post a single system-wide navbar alert (no email targeting)
        await self.create_notification(
            type="OUTBREAK_WARNING",
            title=alert_title,
            message=alert_msg,
            severity=severity_level
        )

        # 2. Find every farmer in radius and email them individually
        notified: list[str] = []
        seen_emails: set[str] = set()

        def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
            return 6371 * 2 * asin(sqrt(a))

        def _is_real_email(email: str) -> bool:
            """Returns False for dummy, fallback, or obvious test addresses."""
            if not email or "@" not in email:
                return False
            if email.endswith("@farmfit.com"):
                return False
            local = email.split("@")[0].lower()
            # Skip obvious test accounts
            if local in {"test", "testuser", "demo", "dummy", "farmer", "example"}:
                return False
            if "test" in local and len(local) <= 8:  # e.g. test123
                return False
            return True

        try:
            tickets = self.db.collection("tickets").stream()
            for ticket in tickets:
                t = ticket.to_dict()
                t_lat = t.get("latitude")
                t_lon = t.get("longitude")
                if t_lat is None or t_lon is None:
                    continue
                if _haversine_km(latitude, longitude, t_lat, t_lon) > radius_km:
                    continue

                # --- Resolve farmer's real email ---
                farmer_email = t.get("email")  # captured at ingestion via Google auth

                # Fallback: look up by phone_number in farmers collection
                if not farmer_email:
                    phone = t.get("phone_number")
                    if phone:
                        try:
                            farmer_doc = self.db.collection("farmers").document(phone).get()
                            if farmer_doc.exists:
                                farmer_email = farmer_doc.to_dict().get("email")
                        except Exception:
                            pass

                # Fallback: query farmers collection where phone_number field matches
                if not farmer_email:
                    phone = t.get("phone_number")
                    if phone:
                        try:
                            matches = (
                                self.db.collection("farmers")
                                .where("phone_number", "==", phone)
                                .limit(1)
                                .stream()
                            )
                            for m in matches:
                                farmer_email = m.to_dict().get("email")
                                break
                        except Exception:
                            pass

                if not _is_real_email(farmer_email):
                    logger.info(f"[NotificationService] Skipping ticket {ticket.id}: no valid email resolved")
                    continue

                if farmer_email in seen_emails:
                    continue  # De-duplicate — don't spam the same farmer twice
                seen_emails.add(farmer_email)

                try:
                    self.email_service.send_alert_notification(
                        alert_type="OUTBREAK_WARNING",
                        title=alert_title,
                        message=alert_msg,
                        severity=severity_level,
                        location=affected_area,
                        recipient_email=farmer_email
                    )
                    logger.info(f"[NotificationService] Outbreak email sent → {farmer_email}")
                    notified.append(farmer_email)
                except Exception as em:
                    logger.error(f"[NotificationService] Email failed for {farmer_email}: {em}")

        except Exception as e:
            logger.error(f"[NotificationService] Radius email scan failed: {e}")

        logger.info(f"[NotificationService] Outbreak radius scan complete. Emailed: {notified}")
        return [{"status": "success", "radial_broadcast": True, "emailed": notified}]

    async def process_offline_queue(self) -> int:
        return 0
