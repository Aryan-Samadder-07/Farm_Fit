from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from services.outbreak_service import OutbreakService
from db import get_db

router = APIRouter(prefix="/api/v1/outbreak", tags=["Outbreak Detection Engine"])

class OutbreakItem(BaseModel):
    disease_name: str
    crop_type: str
    affected_farmer_count: int
    latitude: float
    longitude: float
    district: str
    village: str
    average_confidence: float
    detected_at: str

class OutbreakDetectionResponse(BaseModel):
    outbreaks_detected: int
    outbreaks: List[OutbreakItem]

class OutbreakRegisterRequest(BaseModel):
    disease_name: str = Field(..., description="Disease or pest name")
    crop_type: str = Field(..., description="Affected crop type")
    affected_farmer_count: int = Field(..., ge=1)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    district: str = Field(default="Unknown District")
    village: str = Field(default="Unknown Village")
    reported_by: str = Field(default="RSK Expert")
    notes: Optional[str] = Field(default=None)

@router.post("/detect", response_model=OutbreakDetectionResponse)
async def detect_disease_outbreaks():
    try:
        service = OutbreakService()
        outbreaks = await service.detect_outbreaks()
        return {
            "outbreaks_detected": len(outbreaks),
            "outbreaks": outbreaks
        }
    except Exception as e:
        print(f"Error in detect_disease_outbreaks: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Outbreak spatial detection failed: {str(e)}"
        )

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_outbreak_manually(req: OutbreakRegisterRequest):
    """
    Allows RSK experts to manually register a confirmed disease outbreak
    with GPS coordinates, district, and farmer count.
    Writes directly to the Firestore 'outbreaks' collection.
    """
    try:
        db = get_db()
        outbreak_data = {
            "disease_name": req.disease_name,
            "crop_type": req.crop_type,
            "affected_farmer_count": req.affected_farmer_count,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "district": req.district,
            "village": req.village,
            "average_confidence": 1.0,   # Expert-confirmed = 100% confidence
            "reported_by": req.reported_by,
            "notes": req.notes or "",
            "source": "EXPERT_MANUAL",
            "detected_at": datetime.now().isoformat()
        }

        # Write to Firestore outbreaks collection
        doc_ref = db.collection("outbreaks").document()
        doc_ref.set(outbreak_data)

        # Push a critical alert
        alert_data = {
            "type": "EXPERT_OUTBREAK_REGISTERED",
            "title": f"Expert-Confirmed Outbreak: {req.disease_name}",
            "message": f"{req.reported_by} confirmed {req.disease_name} on {req.crop_type} in {req.village}, {req.district}. {req.affected_farmer_count} farmers affected.",
            "severity": "CRITICAL",
            "created_at": datetime.now().isoformat(),
            "delivered": False
        }
        db.collection("alerts").document().set(alert_data)

        # Propagate geo-fenced warning to farmers in range
        from services.notification_service import NotificationService
        notifier = NotificationService(db)
        await notifier.notify_farmers_in_radius(
            disease_name=req.disease_name,
            affected_area=f"{req.village}, {req.district}",
            severity_level="CRITICAL",
            precautions=req.notes or f"Please inspect your {req.crop_type} fields immediately. An outbreak of {req.disease_name} has been confirmed in your area.",
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=5.0
        )

        return {
            "success": True,
            "outbreak_id": doc_ref.id,
            "message": f"Outbreak '{req.disease_name}' registered successfully in {req.village}, {req.district}."
        }

    except Exception as e:
        print(f"Error in register_outbreak_manually: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register outbreak: {str(e)}"
        )

