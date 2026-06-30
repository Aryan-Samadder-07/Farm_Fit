from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from google.cloud import firestore
from services.diagnosis_service import DiagnosisService
from db import get_db

router = APIRouter(prefix="/api/v1/diagnosis", tags=["Diagnosis Engine"])

@router.post("/diagnose")
async def diagnose_crop_endpoint(
    image: UploadFile = File(...),
    problem_transcript: str = Form(...),
    farmer_name: str = Form("Anonymous Farmer"),
    crop_type: str = Form("Unknown"),
    db: firestore.Client = Depends(get_db)
):
    """
    Multimodal diagnostic endpoint. Receives crop image file upload and farmer transcript description.
    Executes the Gemini diagnosis service, automatically logs the request in the Firestore
    'tickets' collection, and returns the diagnostic analysis.
    """
    try:
        # Read raw image byte stream and content type
        image_bytes = await image.read()
        mime_type = image.content_type or "image/jpeg"
        
        # Invoke diagnosis service using standard configuration settings
        service = DiagnosisService()
        result = await service.diagnose_crop(
            image_bytes=image_bytes,
            mime_type=mime_type,
            problem_transcript=problem_transcript
        )
        
        # Map crop type using scientific diagnosis first-word fallback if unspecified
        inferred_crop = crop_type
        if inferred_crop == "Unknown" and result.disease_name:
            inferred_crop = result.disease_name.split()[0]
        
        # Prepare Firestore ticket payload
        ticket_payload = {
            "farmer_name": farmer_name,
            "crop_type": inferred_crop,
            "problem_transcript": problem_transcript,
            "disease_name": result.disease_name,
            "confidence": result.confidence,
            "severity_level": result.severity_level,
            "actionable_steps": result.actionable_steps,
            "requires_expert": result.requires_expert,
            "status": "PENDING",
            "created_at": firestore.SERVER_TIMESTAMP
        }
        
        # Create doc ref and insert data
        tickets_ref = db.collection("tickets")
        doc_ref = tickets_ref.document()
        doc_ref.set(ticket_payload)
        
        return {
            "ticket_id": doc_ref.id,
            "diagnosis": {
                "disease_name": result.disease_name,
                "confidence": result.confidence,
                "severity_level": result.severity_level,
                "actionable_steps": result.actionable_steps,
                "requires_expert": result.requires_expert
            }
        }
        
    except Exception as e:
        print(f"Error in diagnose_crop_endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Ingestion & Diagnosis pipeline failed: {str(e)}"
        )
