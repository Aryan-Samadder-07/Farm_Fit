from google import genai
from google.genai import types
from google.cloud import firestore
from typing import Dict, Any, List
from config import settings
from db import get_db
from datetime import datetime, timedelta

class DistrictSummaryService:
    def __init__(self):
        self.db = get_db()
        self.client = genai.Client(api_key=settings.gemini_api_key)

    async def generate_district_summary(self, district: str = "SPSR Nellore") -> Dict[str, Any]:
        """
        Aggregates recent Firestore ticket and outbreak data for a district,
        then uses Gemini to generate a human-readable expert summary paragraph.
        """
        # Aggregate tickets for context
        docs = self.db.collection("tickets").limit(30).stream()
        recent_diseases: List[str] = []
        pending_count = 0
        high_sev_count = 0

        for doc in docs:
            data = doc.to_dict()
            if data.get("disease_name"):
                recent_diseases.append(data["disease_name"])
            if data.get("status") == "PENDING":
                pending_count += 1
            if data.get("severity_level") == "HIGH":
                high_sev_count += 1

        # Aggregate outbreaks
        outbreak_docs = self.db.collection("outbreaks").limit(10).stream()
        outbreaks: List[str] = []
        for doc in outbreak_docs:
            d = doc.to_dict()
            if d.get("disease_name"):
                outbreaks.append(f"{d['disease_name']} in {d.get('village', 'Unknown')}")

        # Build Gemini prompt for AI summary
        disease_list = ", ".join(set(recent_diseases)) if recent_diseases else "no diseases reported yet"
        outbreak_list = "; ".join(outbreaks) if outbreaks else "no active outbreaks registered"

        prompt = (
            f"You are an expert agricultural advisor writing a weekly intelligence summary for the "
            f"Rythu Seva Kendra (RSK) district office in {district}, Andhra Pradesh, India.\n\n"
            f"Current district data:\n"
            f"- Pending farmer tickets requiring expert review: {pending_count}\n"
            f"- High-severity disease cases: {high_sev_count}\n"
            f"- Diseases detected this period: {disease_list}\n"
            f"- Active outbreak clusters: {outbreak_list}\n\n"
            f"Write a concise, professional 3-4 sentence district health summary that:\n"
            f"1. States the current agronomic risk level (Low/Moderate/High/Critical)\n"
            f"2. Highlights the most pressing disease threats\n"
            f"3. Gives one concrete recommended action for field officers this week\n"
            f"4. Ends with an overall outlook sentence\n\n"
            f"Write in a direct, authoritative tone suitable for a government agricultural report."
        )

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[prompt],
                config=types.GenerateContentConfig(temperature=0.3, max_output_tokens=300)
            )
            summary_text = response.text.strip() if response.text else self._fallback_summary(district, pending_count, high_sev_count)
        except Exception as e:
            print(f"[DistrictSummaryService] Gemini call failed: {e}")
            summary_text = self._fallback_summary(district, pending_count, high_sev_count)

        # Compute risk level
        if high_sev_count >= 5 or len(outbreaks) >= 2:
            risk_level = "CRITICAL"
        elif high_sev_count >= 2 or pending_count >= 5:
            risk_level = "HIGH"
        elif pending_count >= 2:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        return {
            "district": district,
            "generated_at": datetime.now().isoformat(),
            "risk_level": risk_level,
            "pending_tickets": pending_count,
            "high_severity_cases": high_sev_count,
            "active_outbreaks": len(outbreaks),
            "diseases_detected": list(set(recent_diseases)),
            "ai_summary": summary_text
        }

    def _fallback_summary(self, district: str, pending: int, high_sev: int) -> str:
        return (
            f"The {district} district currently shows a {('HIGH' if high_sev > 2 else 'MODERATE')} agronomic risk profile "
            f"with {pending} pending farmer advisory requests and {high_sev} high-severity crop disease cases on record. "
            f"Field officers are advised to prioritise Late Blight and Rice Blast inspections in the Rabi crop zones this week. "
            f"Continued monitoring of rainfall deficits and soil moisture levels is recommended for the upcoming fortnight."
        )


class AdminAnalyticsService:
    def __init__(self):
        self.db = get_db()

    async def get_analytics(self) -> Dict[str, Any]:
        """
        Aggregates platform-wide statistics for the admin comparison dashboard.
        """
        tickets_docs = list(self.db.collection("tickets").limit(300).stream())
        outbreaks_docs = list(self.db.collection("outbreaks").limit(100).stream())
        alerts_docs = list(self.db.collection("alerts").limit(100).stream())

        # Ticket aggregation
        total_tickets = len(tickets_docs)
        status_counts = {"PENDING": 0, "IN_PROGRESS": 0, "RESOLVED": 0}
        severity_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        disease_freq: Dict[str, int] = {}
        crop_freq: Dict[str, int] = {}

        for doc in tickets_docs:
            d = doc.to_dict()
            s = d.get("status", "PENDING")
            if s in status_counts:
                status_counts[s] += 1
            sev = d.get("severity_level", "LOW")
            if sev in severity_counts:
                severity_counts[sev] += 1
            dn = d.get("disease_name", "")
            if dn:
                disease_freq[dn] = disease_freq.get(dn, 0) + 1
            ct = d.get("crop_type", "")
            if ct:
                crop_freq[ct] = crop_freq.get(ct, 0) + 1

        # Resolution rate
        resolution_rate = round(status_counts["RESOLVED"] / total_tickets * 100, 1) if total_tickets else 0

        # Top diseases (sorted)
        top_diseases = sorted(disease_freq.items(), key=lambda x: x[1], reverse=True)[:6]
        top_crops = sorted(crop_freq.items(), key=lambda x: x[1], reverse=True)[:5]

        # Unread alerts
        unread_alerts = sum(1 for doc in alerts_docs if not doc.to_dict().get("delivered", False))

        # Fallback data if DB is empty
        if total_tickets == 0:
            return self._demo_analytics()

        return {
            "total_tickets": total_tickets,
            "status_breakdown": status_counts,
            "severity_breakdown": severity_counts,
            "resolution_rate_pct": resolution_rate,
            "total_outbreaks": len(outbreaks_docs),
            "unread_alerts": unread_alerts,
            "top_diseases": [{"name": n, "count": c} for n, c in top_diseases],
            "top_crops": [{"name": n, "count": c} for n, c in top_crops],
        }

    def _demo_analytics(self) -> Dict[str, Any]:
        return {
            "total_tickets": 24,
            "status_breakdown": {"PENDING": 9, "IN_PROGRESS": 5, "RESOLVED": 10},
            "severity_breakdown": {"LOW": 6, "MEDIUM": 11, "HIGH": 7},
            "resolution_rate_pct": 41.7,
            "total_outbreaks": 3,
            "unread_alerts": 2,
            "top_diseases": [
                {"name": "Late Blight", "count": 8},
                {"name": "Rice Blast", "count": 6},
                {"name": "Cotton Bollworm", "count": 4},
                {"name": "Leaf Blight", "count": 3},
                {"name": "Fusarium Wilt", "count": 2},
                {"name": "Healthy Plant", "count": 1},
            ],
            "top_crops": [
                {"name": "Tomato", "count": 9},
                {"name": "Rice", "count": 7},
                {"name": "Cotton", "count": 4},
                {"name": "Maize", "count": 3},
                {"name": "Chilli", "count": 1},
            ]
        }
