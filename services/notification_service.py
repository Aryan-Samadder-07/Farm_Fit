from google.cloud import firestore
from typing import List, Dict, Any
from db import get_db

class NotificationService:
    def __init__(self, db: firestore.Client | None = None):
        self.db = db or get_db()

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
