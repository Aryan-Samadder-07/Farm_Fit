from fastapi import APIRouter, HTTPException, Depends, status
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
    crop_type: Optional[str] = None
    problem_transcript: Optional[str] = None
    disease_name: Optional[str] = None
    severity: Optional[str] = None
    actionable_remediation: Optional[str] = None
    requires_expert: bool = True
    status: str = "PENDING"
    expert_remediation: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TicketUpdatePayload(BaseModel):
    status: str = Field(
        ..., 
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

@router.get("/tickets", response_model=List[TicketResponse])
async def get_expert_tickets(db: firestore.Client = Depends(get_db)):
    """
    Retrieves all active tickets from Firestore where `requires_expert` equals True.
    """
    try:
        tickets_ref = db.collection("tickets")
        # Query Firestore where requires_expert field is explicitly True
        query = tickets_ref.where("requires_expert", "==", True)
        docs = query.stream()
        
        tickets = []
        for doc in docs:
            data = doc.to_dict()
            # Convert datetime objects to string format for JSON serialization
            for key, val in list(data.items()):
                if isinstance(val, datetime.datetime):
                    data[key] = val.isoformat()
            
            tickets.append(TicketResponse(id=doc.id, **data))
        return tickets
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tickets from Firestore: {str(e)}"
        )

@router.patch("/tickets/{ticket_id}", response_model=dict)
async def update_ticket_resolution(
    ticket_id: str, 
    payload: TicketUpdatePayload, 
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
        if payload.requires_expert is not None:
            update_data["requires_expert"] = payload.requires_expert
            
        update_data["updated_at"] = firestore.SERVER_TIMESTAMP
        
        ticket_ref.update(update_data)
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
