from fastapi import APIRouter, HTTPException, Query
from services.district_summary_service import DistrictSummaryService, AdminAnalyticsService

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Intelligence"])

@router.get("/analytics")
async def get_admin_analytics():
    """Returns platform-wide aggregated statistics for the admin dashboard."""
    try:
        service = AdminAnalyticsService()
        return await service.get_analytics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/district-summary")
async def generate_district_ai_summary(
    district: str = Query("SPSR Nellore", description="District name to summarise")
):
    """Generates a Gemini AI-powered weekly district health summary."""
    try:
        service = DistrictSummaryService()
        return await service.generate_district_summary(district=district)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/autofill-advisory")
async def autofill_expert_advisory(payload: dict):
    """
    Uses Gemini to suggest expert advisory notes given disease, severity, and crop context.
    Used by the RSK Expert Portal resolution drawer for one-click AI autofill.
    """
    from google import genai
    from google.genai import types
    from config import settings

    disease = payload.get("disease_name", "Unknown Disease")
    crop = payload.get("crop_type", "Unknown Crop")
    severity = payload.get("severity_level", "MEDIUM")
    transcript = payload.get("voice_transcript", "")

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        prompt = (
            f"You are an RSK (Rythu Seva Kendra) agricultural expert in Andhra Pradesh, India.\n"
            f"A farmer has reported the following issue:\n"
            f"- Crop: {crop}\n"
            f"- Diagnosed Disease: {disease} (Severity: {severity})\n"
            f"- Farmer's description: \"{transcript}\"\n\n"
            f"Write a brief, practical expert advisory note (3-4 sentences) that an RSK field officer "
            f"would write to resolve this ticket. Include specific local recommendations (Indian brand "
            f"names, organic alternatives, and follow-up schedule). Be direct and actionable."
        )
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=200)
        )
        advisory = response.text.strip() if response.text else "Please inspect the field and apply recommended fungicides as per ANGRAU guidelines."
    except Exception as e:
        advisory = f"Apply standard treatment protocol for {disease} on {crop}. Monitor for 7 days and escalate if spread continues."

    return {"advisory": advisory}
