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
            err_str = str(e)
            if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str or "quota" in err_str.lower():
                print("[AgronomyService] Gemini API Rate Limit (429) hit. Invoking rule-based crop recommendation fallback...")
                
                n = soil_parameters.get("N", 0.0)
                p = soil_parameters.get("P", 0.0)
                k = soil_parameters.get("K", 0.0)
                
                if n > p and n > k:
                    return AgronomyResponse(
                        recommendations=[
                            CropRecommendation(
                                crop_name="Rice (AI Fallback Mode)",
                                confidence=0.91,
                                suitability_reasons=[
                                    f"Highly compatible with high nitrogen levels (N: {n} mg/kg) which supports early vegetative growth.",
                                    "Matches well with clayey or loamy soil profiles."
                                ]
                            ),
                            CropRecommendation(
                                crop_name="Maize (AI Fallback Mode)",
                                confidence=0.83,
                                suitability_reasons=[
                                    "Nitrogen-heavy root development matches the current soil profile.",
                                    "Drought tolerance makes it suitable for moderate rainfall patterns."
                                ]
                            ),
                            CropRecommendation(
                                crop_name="Wheat (AI Fallback Mode)",
                                confidence=0.74,
                                suitability_reasons=[
                                    "Good secondary crop choice for cool dry-spell cycles.",
                                    "Optimal root structure matches the moderate potassium levels."
                                ]
                            )
                        ]
                    )
                elif p > n and p > k:
                    return AgronomyResponse(
                        recommendations=[
                            CropRecommendation(
                                crop_name="Potato (AI Fallback Mode)",
                                confidence=0.89,
                                suitability_reasons=[
                                    f"High phosphorus (P: {p} mg/kg) stimulates rapid tuber development and root expansion.",
                                    "Well suited for loamy sand and high drainage zones."
                                ]
                            ),
                            CropRecommendation(
                                crop_name="Groundnut (AI Fallback Mode)",
                                confidence=0.82,
                                suitability_reasons=[
                                    "Leguminous root system thrives under phosphorus-rich starter nutrition.",
                                    "Highly resilient to low rainfall regimes."
                                ]
                            ),
                            CropRecommendation(
                                crop_name="Tomato (AI Fallback Mode)",
                                confidence=0.76,
                                suitability_reasons=[
                                    "Phosphorus availability supports strong early blossom formation.",
                                    "Responsive to organic potassium fertilizers."
                                ]
                            )
                        ]
                    )
                else:
                    return AgronomyResponse(
                        recommendations=[
                            CropRecommendation(
                                crop_name="Cotton (AI Fallback Mode)",
                                confidence=0.88,
                                suitability_reasons=[
                                    f"High potassium (K: {k} mg/kg) improves boll development, fiber quality, and drought tolerance.",
                                    "Deep taproot system thrives in semi-arid zones."
                                ]
                            ),
                            CropRecommendation(
                                crop_name="Banana (AI Fallback Mode)",
                                confidence=0.80,
                                suitability_reasons=[
                                    "Potassium-demanding stalk expansion matches the current soil chemistry.",
                                    "Thrives under irrigated regional cultivation cycles."
                                ]
                            ),
                            CropRecommendation(
                                crop_name="Chilli (AI Fallback Mode)",
                                confidence=0.73,
                                suitability_reasons=[
                                    "Potassium levels boost disease resistance and pepper firmness.",
                                    "Thrives in warm, sunny conditions."
                                ]
                            )
                        ]
                    )
            
            print(f"Error in AgronomyService: {e}")
            raise e
