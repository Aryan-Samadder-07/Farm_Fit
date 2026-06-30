from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List
from config import settings

class CropRecommendation(BaseModel):
    crop_name: str = Field(
        description="Name of the recommended crop."
    )
    confidence: float = Field(
        description="Confidence score for this recommendation, expressed as a fraction between 0.0 and 1.0 (e.g., 0.92 for 92%)."
    )
    suitability_reasons: List[str] = Field(
        description="Detailed, agronomic reasons explaining why this crop is highly compatible with the given soil parameters and rainfall metrics."
    )

class AgronomyResponse(BaseModel):
    recommendations: List[CropRecommendation] = Field(
        description="Top 3 recommended crops sorted by confidence levels in descending order."
    )

class AgronomyService:
    def __init__(self, api_key: str | None = None):
        key = api_key or settings.gemini_api_key or None
        self.client = genai.Client(api_key=key)

    async def recommend_crops(
        self,
        soil_parameters: dict[str, float],
        historical_rainfall: dict[str, float] | list[float] | float
    ) -> AgronomyResponse:
        """
        Takes soil parameters (N, P, K, pH) and historical rainfall metrics,
        and requests structured recommendations from Gemini.
        """
        try:
            # Construct a clear prompt detailing the inputs
            n = soil_parameters.get("N", 0.0)
            p = soil_parameters.get("P", 0.0)
            k = soil_parameters.get("K", 0.0)
            ph = soil_parameters.get("pH", 7.0)
            
            prompt = (
                f"Agronomic Soil Parameters:\n"
                f"- Nitrogen (N): {n} mg/kg\n"
                f"- Phosphorus (P): {p} mg/kg\n"
                f"- Potassium (K): {k} mg/kg\n"
                f"- Soil pH: {ph}\n\n"
                f"Historical Rainfall Metrics: {historical_rainfall}\n\n"
                f"Analyze these crop growth variables and provide the top 3 optimal crop recommendations "
                f"suitable for planting, including confidence percentages and scientific suitability reasons."
            )

            # Request Gemini content generation with the AgronomyResponse schema
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AgronomyResponse,
                    temperature=0.1,
                )
            )

            if response.parsed:
                return response.parsed
            
            raise ValueError("Failed to parse agronomy recommendations from Gemini.")

        except Exception as e:
            print(f"Error in AgronomyService: {e}")
            raise e
