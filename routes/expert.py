from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from google.cloud import firestore
from pydantic import BaseModel, Field
from typing import List, Optional
import datetime
from db import get_db

router = APIRouter(prefix="/api/v1/expert", tags=["Expert Panel"])

# Pydantic schemas for request/response serialization
class TicketResponse(BaseModel):
    id: str
    farmer_name: Optional[str] = None
    phone_number: Optional[str] = None
    village_name: Optional[str] = None
    crop_type: Optional[str] = None
    problem_transcript: Optional[str] = None
    disease_name: Optional[str] = None
    confidence: Optional[float] = None
    severity_level: Optional[str] = None
    actionable_steps: Optional[str] = None
    requires_expert: bool = True
    status: str = "PENDING"
    expert_remediation: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_phone: Optional[str] = None
    on_hold: Optional[bool] = None

class TicketUpdatePayload(BaseModel):
    status: Optional[str] = Field(
        None, 
        description="The updated state of the ticket, typically 'RESOLVED', 'IN_PROGRESS', or 'PENDING'."
    )
    expert_remediation: Optional[str] = Field(
        None, 
        description="The detailed agronomic advice provided by the expert to resolve the farmer's ticket."
    )
    requires_expert: Optional[bool] = Field(
        None, 
        description="Flags whether the ticket still needs to remain in the active expert worklist."
    )
    assigned_to: Optional[str] = Field(
        None,
        description="Name of the expert assigned to the ticket."
    )
    assigned_phone: Optional[str] = Field(
        None,
        description="Phone number of the assigned expert."
    )
    on_hold: Optional[bool] = Field(
        None,
        description="Flags if the ticket is placed on hold for on-site visit."
    )

@router.get("/tickets", response_model=List[TicketResponse])
async def get_expert_tickets(db: firestore.Client = Depends(get_db)):
    """
    Retrieves all active tickets from Firestore where `requires_expert` equals True.
    """
    try:
        tickets_ref = db.collection("tickets")
        query = tickets_ref.where("requires_expert", "==", True)
        docs = query.stream()
        
        tickets = []
        for doc in docs:
            data = doc.to_dict()
            for key, val in list(data.items()):
                if isinstance(val, datetime.datetime):
                    data[key] = val.isoformat()
                elif hasattr(val, 'isoformat'):
                    data[key] = str(val)
            tickets.append(TicketResponse(id=doc.id, **data))
        return tickets
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tickets from Firestore: {str(e)}"
        )

@router.get("/tickets/all")
async def get_all_tickets(db: firestore.Client = Depends(get_db)):
    """
    Returns ALL tickets from Firestore regardless of requires_expert flag,
    ordered by created_at descending. Used by the RSK Expert Portal queue.
    """
    try:
        docs = db.collection("tickets").order_by(
            "created_at", direction=firestore.Query.DESCENDING
        ).limit(200).stream()

        tickets = []
        for doc in docs:
            data = doc.to_dict()
            serialized: dict = {"id": doc.id}
            for key, val in data.items():
                if isinstance(val, datetime.datetime):
                    serialized[key] = val.isoformat()
                elif hasattr(val, 'isoformat'):
                    serialized[key] = str(val)
                else:
                    serialized[key] = val
            # Normalise field aliases between old and new diagnosis writes
            if "problem_transcript" in serialized and "voice_transcript" not in serialized:
                serialized["voice_transcript"] = serialized["problem_transcript"]
            if "actionable_steps" in serialized and "remediation_steps" not in serialized:
                serialized["remediation_steps"] = serialized["actionable_steps"]
            tickets.append(serialized)

        return {"tickets": tickets, "total": len(tickets)}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch all tickets: {str(e)}"
        )


@router.get("/tickets/{ticket_id}")
async def get_single_ticket(ticket_id: str, db: firestore.Client = Depends(get_db)):
    """
    Retrieves a single ticket by its ID from the Firestore 'tickets' collection.
    """
    try:
        doc = db.collection("tickets").document(ticket_id).get()
        if not doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Ticket does not exist"
            )
        data = doc.to_dict()
        serialized = {"id": doc.id}
        for key, val in data.items():
            if isinstance(val, datetime.datetime):
                serialized[key] = val.isoformat()
            elif hasattr(val, 'isoformat'):
                serialized[key] = str(val)
            else:
                serialized[key] = val
        if "problem_transcript" in serialized and "voice_transcript" not in serialized:
            serialized["voice_transcript"] = serialized["problem_transcript"]
        if "actionable_steps" in serialized and "remediation_steps" not in serialized:
            serialized["remediation_steps"] = serialized["actionable_steps"]
            
        # Translate to English on-the-fly for old tickets if missing
        if "english_transcript" not in serialized or not serialized["english_transcript"]:
            transcript = serialized.get("problem_transcript") or serialized.get("voice_transcript")
            if transcript:
                from services.translation_service import TranslationService
                ts = TranslationService()
                lang = ts.detect_language(transcript)
                if lang != "en":
                    serialized["english_transcript"] = ts.translate_to_english(transcript, source_language=lang)
                else:
                    serialized["english_transcript"] = transcript
                    
        return serialized
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve ticket: {str(e)}"
        )


async def _trigger_farmer_notifications(
    db: firestore.Client,
    ticket_id: str,
    ticket_doc: dict,
    status_updated: bool,
    expert_remediation: Optional[str],
    on_hold_updated: bool,
    assigned_to: Optional[str],
    assigned_phone: Optional[str]
):
    try:
        farmer_phone = ticket_doc.get("phone_number")
        farmer_name = ticket_doc.get("farmer_name") or "Farmer"
        crop_type = ticket_doc.get("crop_type") or "Crop"
        
        # Lookup farmer email from database
        farmer_email = ticket_doc.get("email")
        if not farmer_email and farmer_phone:
            try:
                farmer_ref = db.collection("farmers").document(farmer_phone).get()
                if farmer_ref.exists:
                    farmer_email = farmer_ref.to_dict().get("email")
            except Exception as lookup_err:
                print(f"[Notifications] Farmer email lookup failed: {lookup_err}")
        
        from services.notification_service import NotificationService
        notifier = NotificationService(db)

        # 1. Expert Response / Status Notification
        if (expert_remediation is not None) or status_updated:
            lang = ticket_doc.get("language_code") or ticket_doc.get("detected_language")
            if not lang:
                # Detect the language from the problem transcript on the fly
                transcript = ticket_doc.get("problem_transcript") or ticket_doc.get("voice_transcript") or ""
                from services.translation_service import TranslationService
                ts = TranslationService()
                lang = ts.detect_language(transcript)
            lang_prefix = lang.split("-")[0] if lang else "en"
            
            remediation_text = expert_remediation or "Your advisory report has been reviewed."
            
            raw_msg = (
                f"Dear {farmer_name},\n\n"
                f"An RSK expert has completed the review of your crop diagnosis request for '{crop_type}'.\n\n"
                f"Expert Advisory / Recommendation:\n"
                f"{remediation_text}\n\n"
                f"Best regards,\n"
                f"Rythu Seva Kendra (RSK) Team"
            )
            
            from services.translation_service import TranslationService
            translator = TranslationService()
            localized_msg = raw_msg
            if lang_prefix != "en":
                localized_msg = translator.translate_from_english(raw_msg, target_language=lang_prefix)
                
            await notifier.create_notification(
                type="EXPERT_ADVISORY",
                title=f"Expert Response: {crop_type}",
                message=localized_msg,
                severity="HIGH",
                ticket_id=ticket_id,
                email=farmer_email
            )

        # 2. Hold for On-Site Notification
        if on_hold_updated:
            expert_name = assigned_to or ticket_doc.get("assigned_to") or "RSK Expert"
            expert_phone = assigned_phone or ticket_doc.get("assigned_phone") or "Rythu Seva Kendra"
            
            notification_message = (
                f"Dear {farmer_name},\n\n"
                f"An RSK expert field visit has been scheduled for your farm in the next 24 hours regarding your '{crop_type}' request.\n\n"
                f"Please contact RSK Expert {expert_name} at {expert_phone} to coordinate the exact time and location.\n\n"
                f"Best regards,\n"
                f"Rythu Seva Kendra (RSK) Team"
            )
            
            await notifier.create_notification(
                type="ON_SITE_VISIT",
                title=f"On-Site Field Visit Scheduled - {crop_type}",
                message=notification_message,
                severity="HIGH",
                ticket_id=ticket_id,
                email=farmer_email
            )
    except Exception as e:
        print(f"[BackgroundTasks] Expert notification dispatch failed: {e}")


@router.patch("/tickets/{ticket_id}", response_model=dict)
async def update_ticket_resolution(
    ticket_id: str, 
    payload: TicketUpdatePayload, 
    background_tasks: BackgroundTasks,
    db: firestore.Client = Depends(get_db)
):
    """
    Updates the resolution status and agronomic advice for a specific ticket.
    """
    try:
        ticket_ref = db.collection("tickets").document(ticket_id)
        doc = ticket_ref.get()
        
        if not doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Ticket does not exist"
            )
            
        # Build document update dictionary based on provided attributes
        update_data = {}
        if payload.status is not None:
            update_data["status"] = payload.status
        if payload.expert_remediation is not None:
            update_data["expert_remediation"] = payload.expert_remediation
            
            # Translate expert advisory note to local language if not English
            ticket_doc = doc.to_dict() or {}
            lang = ticket_doc.get("language_code") or ticket_doc.get("detected_language") or "en"
            lang_prefix = lang.split("-")[0]
            if lang_prefix != "en":
                from services.translation_service import TranslationService
                translator = TranslationService()
                localized_remediation = translator.translate_from_english(payload.expert_remediation, target_language=lang_prefix)
                update_data["localized_expert_remediation"] = localized_remediation
            else:
                update_data["localized_expert_remediation"] = payload.expert_remediation
        if payload.requires_expert is not None:
            update_data["requires_expert"] = payload.requires_expert
        if payload.assigned_to is not None:
            update_data["assigned_to"] = payload.assigned_to
        if payload.assigned_phone is not None:
            update_data["assigned_phone"] = payload.assigned_phone
        if payload.on_hold is not None:
            update_data["on_hold"] = payload.on_hold
            
        update_data["updated_at"] = firestore.SERVER_TIMESTAMP
        
        ticket_ref.update(update_data)

        # Trigger farmer notifications only on explicit resolutions or hold-for-visit scheduling
        should_notify = (payload.expert_remediation is not None) or (payload.status == "RESOLVED") or (payload.on_hold is True)
        if should_notify:
            background_tasks.add_task(
                _trigger_farmer_notifications,
                db=db,
                ticket_id=ticket_id,
                ticket_doc=doc.to_dict() or {},
                status_updated=(payload.status == "RESOLVED"),
                expert_remediation=payload.expert_remediation,
                on_hold_updated=(payload.on_hold is True),
                assigned_to=payload.assigned_to,
                assigned_phone=payload.assigned_phone
            )

        return {
            "status": "success", 
            "message": f"Ticket {ticket_id} successfully updated."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update ticket: {str(e)}"
        )
