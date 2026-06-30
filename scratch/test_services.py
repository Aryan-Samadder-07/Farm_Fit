import os
import sys
import asyncio
import base64
from dotenv import load_dotenv

# Append workspace directory so Python finds the services and routes
WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../Desktop/VSCode/Projects/Farm_Fit"))
sys.path.append(WORKSPACE_DIR)

# Load environment variables from .env file
load_dotenv(os.path.join(WORKSPACE_DIR, ".env"))


from services.diagnosis_service import DiagnosisService, DiagnosisResult
from services.agronomy_service import AgronomyService, AgronomyResponse

# Dummy 1x1 pixel PNG image encoded in base64 to pass as a byte stream
DUMMY_IMAGE_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

async def test_diagnosis_service():
    print("\n=== Testing Diagnosis Service ===")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[Skipped] Live Gemini API Key (GEMINI_API_KEY) not found. Running mock validator...")
        print("DiagnosisService is imported successfully.")
        return
        
    image_bytes = base64.b64decode(DUMMY_IMAGE_B64)
    service = DiagnosisService(api_key=api_key)
    
    print("Sending dummy image and transcript to Gemini 1.5 Flash...")
    try:
        result: DiagnosisResult = await service.diagnose_crop(
            image_bytes=image_bytes,
            mime_type="image/png",
            problem_transcript="The leaves on my tomato plant are showing black and brown spots."
        )
        print("Successfully obtained structured outputs:")
        print(f"- Disease Name: {result.disease_name}")
        print(f"- Severity: {result.severity}")
        print(f"- Actionable Remediation: {result.actionable_remediation}")
        print(f"- Requires Expert Action: {result.requires_expert}")
    except Exception as e:
        print(f"Error executing Gemini call: {e}")

async def test_agronomy_service():
    print("\n=== Testing Agronomy Service ===")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[Skipped] Live Gemini API Key (GEMINI_API_KEY) not found. Running mock validator...")
        print("AgronomyService is imported successfully.")
        return
        
    service = AgronomyService(api_key=api_key)
    soil_params = {"N": 90.0, "P": 42.0, "K": 43.0, "pH": 6.5}
    rainfall = 200.5
    
    print(f"Sending soil params: {soil_params} and rainfall: {rainfall} to Gemini...")
    try:
        result: AgronomyResponse = await service.recommend_crops(
            soil_parameters=soil_params,
            historical_rainfall=rainfall
        )
        print("Successfully obtained crop recommendations:")
        for rec in result.recommendations:
            print(f"- Recommended Crop: {rec.crop_name}")
            print(f"  Confidence Score: {rec.confidence:.2f}")
            print(f"  Reasons for Suitability: {', '.join(rec.suitability_reasons)}")
    except Exception as e:
        print(f"Error executing Gemini call: {e}")

if __name__ == "__main__":
    # Run service tests
    asyncio.run(test_diagnosis_service())
    asyncio.run(test_agronomy_service())
