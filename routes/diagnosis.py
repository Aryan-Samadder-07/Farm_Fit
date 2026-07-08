from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status, BackgroundTasks
from typing import Optional, List
import base64
import logging
logger = logging.getLogger(__name__)
from google.cloud import firestore
from services.diagnosis_service import DiagnosisService
from services.translation_service import TranslationService
from db import get_db

router = APIRouter(prefix="/api/v1/diagnosis", tags=["Diagnosis Engine"])

@router.post("/diagnose")
async def diagnose_crop_endpoint(
    images: List[UploadFile] = File(...),
    problem_transcript: str = Form(...),
    farmer_name: str = Form("Anonymous Farmer"),
    crop_type: str = Form("Unknown"),
    phone_number: Optional[str] = Form(None),
    village_name: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    email: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = None,
    db: firestore.Client = Depends(get_db)
):
    """
    Multimodal diagnostic endpoint. Receives crop image file uploads and farmer transcript description.
    Executes the Gemini diagnosis service, automatically logs the request in the Firestore
    'tickets' collection, and returns the diagnostic analysis.
    """
    try:
        if not images:
            raise HTTPException(status_code=400, detail="At least one leaf image is required.")

        # Translate input transcript to English if it is in local language
        translation_service = TranslationService()
        lang_code = translation_service.detect_language(problem_transcript)
        english_transcript = problem_transcript
        if lang_code != "en":
            english_transcript = translation_service.translate_to_english(problem_transcript, source_language=lang_code)

        # Auto-translate crop type to English if it is in a local script
        english_crop_type = crop_type
        if crop_type and crop_type != "Unknown":
            crop_lang_code = translation_service.detect_language(crop_type)
            if crop_lang_code != "en":
                english_crop_type = translation_service.translate_to_english(crop_type, source_language=crop_lang_code)

        # Read all images and encode to base64 for persistent database logging
        images_base64 = []
        images_payload = []
        for img in images:
            image_bytes = await img.read()
            mime_type = img.content_type or "image/jpeg"
            encoded_str = base64.b64encode(image_bytes).decode("utf-8")
            images_base64.append(f"data:{mime_type};base64,{encoded_str}")
            images_payload.append((image_bytes, mime_type))
        
        # Invoke diagnosis service using standard configuration settings
        service = DiagnosisService()
        result = await service.diagnose_crop(
            images_list=images_payload,
            problem_transcript=english_transcript
        )
        
        # Map crop type using scientific diagnosis first-word fallback if unspecified
        inferred_crop = english_crop_type
        if inferred_crop == "Unknown" and result.disease_name:
            inferred_crop = result.disease_name.split()[0]
        
        # Prepare Firestore ticket payload
        ticket_payload = {
            "farmer_name": farmer_name,
            "crop_type": crop_type,
            "english_crop_type": english_crop_type,
            "problem_transcript": problem_transcript,
            "english_transcript": english_transcript,
            "detected_language": lang_code,
            "language_code": f"{lang_code}-IN",
            "disease_name": result.disease_name,
            "confidence": result.confidence,
            "severity_level": result.severity_level,
            "actionable_steps": result.actionable_steps,
            "requires_expert": result.requires_expert,
            "status": "PENDING",
            "images": images_base64,
            "created_at": firestore.SERVER_TIMESTAMP
        }
        if phone_number:
            ticket_payload["phone_number"] = phone_number
        if email:
            ticket_payload["email"] = email
        if village_name:
            ticket_payload["village_name"] = village_name
        if latitude is not None:
            ticket_payload["latitude"] = latitude
        if longitude is not None:
            ticket_payload["longitude"] = longitude
        
        # Create doc ref and insert data
        tickets_ref = db.collection("tickets")
        doc_ref = tickets_ref.document()
        doc_ref.set(ticket_payload)

        # Localize results if native language detected
        localized_disease_name = result.disease_name
        localized_actionable_steps = result.actionable_steps
        if lang_code != "en":
            localized_disease_name, localized_actionable_steps = translation_service.translate_diagnosis_result(
                disease_name=result.disease_name,
                actionable_steps=result.actionable_steps,
                target_language=lang_code
            )
        
        return {
            "ticket_id": doc_ref.id,
            "detected_language": lang_code,
            "english_transcript": english_transcript,
            "diagnosis": {
                "disease_name": result.disease_name,
                "confidence": result.confidence,
                "severity_level": result.severity_level,
                "actionable_steps": result.actionable_steps,
                "requires_expert": result.requires_expert
            },
            "localized_diagnosis": {
                "disease_name": localized_disease_name,
                "actionable_steps": localized_actionable_steps
            } if lang_code != "en" else None
        }
        
    except Exception as e:
        print(f"Error in diagnose_crop_endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Ingestion & Diagnosis pipeline failed: {str(e)}"
        )
