from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Literal
from config import settings

class DiagnosisResult(BaseModel):
    disease_name: str = Field(
        description="Scientific or common name of the diagnosed crop disease (e.g., 'Late Blight', 'Rice Blast') or 'Healthy' if no disease is found."
    )
    confidence: float = Field(
        description="Confidence score of the diagnosis as a percentage decimal between 0.0 and 1.0 (e.g., 0.92 for 92%)."
    )
    severity_level: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="Criticality levels based on spread and potential yield impact."
    )
    actionable_steps: str = Field(
        description="Highly descriptive, actionable, step-by-step remediation advice for the farmer (organic, cultural, or chemical solutions)."
    )
    requires_expert: bool = Field(
        description="Must be set to True if severity_level is HIGH, or if the diagnosis is ambiguous, or if field inspection by a Rythu Seva Kendra (RSK) expert is needed."
    )

class DiagnosisService:
    def __init__(self, api_key: str | None = None):
        # Use provided API key, config settings, or default environment variable GEMINI_API_KEY
        key = api_key or settings.gemini_api_key or None
        self.client = genai.Client(api_key=key)

    async def diagnose_crop(
        self, 
        image_bytes: bytes, 
        mime_type: str, 
        problem_transcript: str
    ) -> DiagnosisResult:
        """
        Sends an image byte stream and problem description to Gemini 1.5 Flash 
        and returns a strongly-typed structured JSON response mapping crop diagnosis details.
        """
        try:
            # Create a multimodal payload containing image bytes and user's transcript prompt
            contents = [
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                f"The following is a transcript of the farmer reporting the issue: '{problem_transcript}'.\n"
                f"Analyze the attached image of the crop leaf/stalk and the farmer's report. "
                f"Perform a professional agronomic diagnosis and output the classification schema."
            ]

            # Generate content enforcing Pydantic schema structure
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DiagnosisResult,
                    temperature=0.1,  # Low temperature for deterministic diagnostic accuracy
                )
            )

            # Response.parsed automatically holds the instantiated Pydantic model
            if response.parsed:
                return response.parsed
            
            raise ValueError("Failed to parse Gemini response into expected DiagnosisResult model.")

        except Exception as e:
            # Check for API rate limit or quota issues
            err_str = str(e)
            if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str or "quota" in err_str.lower():
                print("[DiagnosisService] Gemini API Rate Limit (429) hit. Invoking intelligent rule-based fallback parser...")
                
                transcript_lower = problem_transcript.lower()
                if "curling" in transcript_lower or "blight" in transcript_lower or "black spots" in transcript_lower:
                    return DiagnosisResult(
                        disease_name="Late Blight (AI Fallback Mode)",
                        confidence=0.88,
                        severity_level="HIGH",
                        actionable_steps="Apply copper-based fungicides immediately. Prune affected leaves and destroy them to prevent spore spread. (Generated using local rule fallback)",
                        requires_expert=True
                    )
                elif "blast" in transcript_lower or "grey center" in transcript_lower or "spindle" in transcript_lower:
                    return DiagnosisResult(
                        disease_name="Rice Blast (AI Fallback Mode)",
                        confidence=0.81,
                        severity_level="MEDIUM",
                        actionable_steps="Avoid excessive nitrogen fertilizers. Spray Tricyclazole at recommended doses. Keep field drained. (Generated using local rule fallback)",
                        requires_expert=True
                    )
                elif "yellowing" in transcript_lower or "stunted" in transcript_lower or "wrinkled" in transcript_lower:
                    return DiagnosisResult(
                        disease_name="Minor Leafhopper damage (AI Fallback Mode)",
                        confidence=0.74,
                        severity_level="LOW",
                        actionable_steps="No immediate chemical spray needed. Install yellow sticky traps and monitor pests weekly. (Generated using local rule fallback)",
                        requires_expert=False
                    )
                else:
                    return DiagnosisResult(
                        disease_name="Ambiguous Leaf Spots (AI Fallback Mode)",
                        confidence=0.68,
                        severity_level="MEDIUM",
                        actionable_steps="Maintain field cleanliness. Inspect underside of leaves for pests, reduce watering, and consult local extension agent. (Generated using local rule fallback)",
                        requires_expert=True
                    )
            
            print(f"Error in DiagnosisService: {e}")
            raise e
