from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import httpx
from services.agronomy_service import AgronomyService
from config import settings

router = APIRouter(prefix="/api/v1/agronomy", tags=["Agronomy recommendation"])


# ── Freeform Gemini query endpoint (used by dashboard voice input) ─────────────

class AgronomyQueryRequest(BaseModel):
    query: str = Field(..., description="Freeform agricultural question in English")


@router.post("/query")
async def agronomy_gemini_query(payload: AgronomyQueryRequest):
    """
    Sends a freeform agricultural question to Gemini 2.5 Flash for analysis.
    Returns a structured advisory response. Used by the RSK Dashboard voice input.
    """
    question = payload.query.strip()
    if not question:
        raise HTTPException(status_code=400, detail="query must not be empty.")

    # System prompt for agricultural expert persona
    system_prompt = (
        "You are an expert agronomist and crop disease specialist for the Indian agricultural context. "
        "Provide concise, actionable advice in 3-5 sentences. Focus on: "
        "1) Immediate remediation steps, 2) Recommended pesticide/fungicide (generic names), "
        "3) Preventive measures. Always keep farmer economic constraints in mind."
    )

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_prompt,
        )
        response = model.generate_content(question)
        answer = response.text.strip() if response.text else ""
        return {"query": question, "response": answer}
    except Exception as e:
        # Fallback advisory if Gemini is unavailable
        print(f"[Agronomy Gemini Query] Error: {e}")
        fallback = (
            f"Advisory for '{question}': Apply appropriate fungicide or pesticide based on the crop and "
            f"disease observed. Maintain proper field hygiene, ensure good air circulation between plants, "
            f"and monitor soil moisture. Consult your local RSK or KVK extension officer for specific "
            f"product recommendations suitable for your region."
        )
        return {"query": question, "response": fallback}


class RecommendationRequest(BaseModel):
    N: float = Field(..., description="Nitrogen level in mg/kg")
    P: float = Field(..., description="Phosphorus level in mg/kg")
    K: float = Field(..., description="Potassium level in mg/kg")
    pH: float = Field(7.0, description="Soil pH level")
    latitude: float = Field(14.44, description="Latitude for local rainfall lookup")
    longitude: float = Field(79.98, description="Longitude for local rainfall lookup")

async def get_historical_rainfall(lat: float, lon: float) -> float:
    """
    Fetches the total cumulative rainfall for the past 14 days from the Open-Meteo API.
    """
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&past_days=14&daily=rain&timezone=auto"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(url, timeout=5.0)
            if res.status_code == 200:
                data = res.json()
                rain_list = data.get("daily", {}).get("rain", [])[:14]
                return sum([r for r in rain_list if r is not None])
    except Exception as e:
        print(f"[Recommendation API] Weather lookup failed: {e}. Using fallback default rainfall.")
    return 120.0  # sensible average rainfall fallback in mm

@router.post("/recommend")
async def recommend_crops_endpoint(payload: RecommendationRequest):
    try:
        # 1. Fetch cumulative 14-day rainfall for the location
        rainfall = await get_historical_rainfall(payload.latitude, payload.longitude)
        
        # 2. Package soil parameters
        soil_params = {
            "N": payload.N,
            "P": payload.P,
            "K": payload.K,
            "pH": payload.pH
        }
        
        # 3. Request recommendations from AgronomyService
        service = AgronomyService()
        result = await service.recommend_crops(
            soil_parameters=soil_params,
            historical_rainfall=rainfall
        )
        
        return {
            "rainfall_calculated_mm": round(rainfall, 1),
            "recommendations": [
                {
                    "crop_name": rec.crop_name,
                    "confidence": rec.confidence,
                    "suitability_reasons": rec.suitability_reasons
                }
                for rec in result.recommendations
            ]
        }
    except Exception as e:
        print(f"Error in recommend_crops_endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agronomy recommendation engine failed: {str(e)}"
        )
