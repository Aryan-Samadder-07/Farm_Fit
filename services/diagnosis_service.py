from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import Literal
from config import settings

class DiagnosisResult(BaseModel):
    disease_name: str = Field(
        description="Scientific or common name of the diagnosed crop disease (e.g., 'Late Blight', 'Rice Blast') or 'Healthy' if no disease is found."
    )
    severity: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="Criticality levels based on spread and potential yield impact."
    )
    actionable_remediation: str = Field(
        description="Highly descriptive, actionable, step-by-step remediation advice for the farmer (organic, cultural, or chemical solutions)."
    )
    requires_expert: bool = Field(
        description="Must be set to True if severity is HIGH, or if the diagnosis is ambiguous, or if field inspection by a Rythu Seva Kendra (RSK) expert is needed."
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
            # For production stability, log error details and raise appropriately
            # (In a real app, a proper logger would be used here)
            print(f"Error in DiagnosisService: {e}")
            raise e
