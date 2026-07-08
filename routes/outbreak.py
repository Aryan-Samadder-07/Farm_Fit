from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from services.outbreak_service import OutbreakService
from services.email_service import EmailService
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
    affected_farmer_count: Optional[int] = Field(default=None)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    district: Optional[str] = Field(default=None)
    village: Optional[str] = Field(default=None)
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
    Allows RSK experts to manually register a confirmed disease outbreak.
    Auto-calculates affected farmers and auto-finds nearest village/district.
    """
    try:
        db = get_db()

        # 1. Reverse-geocode GPS coordinates to get actual village/district via OSM Nominatim
        import urllib.request
        import json as _json

        auto_village = "Unknown Village"
        auto_district = "Unknown District"
        try:
            nominatim_url = (
                f"https://nominatim.openstreetmap.org/reverse"
                f"?format=json&lat={req.latitude}&lon={req.longitude}&zoom=14&addressdetails=1"
            )
            req_osm = urllib.request.Request(
                nominatim_url,
                headers={"User-Agent": "FarmFit-RSK/1.0 (rythusevakendra@gmail.com)"}
            )
            with urllib.request.urlopen(req_osm, timeout=5) as resp:
                geo_data = _json.loads(resp.read().decode())
            addr = geo_data.get("address", {})
            # Try progressively coarser names for village
            auto_village = (
                addr.get("village")
                or addr.get("town")
                or addr.get("suburb")
                or addr.get("neighbourhood")
                or addr.get("municipality")
                or addr.get("county")
                or "Unknown Village"
            )
            # District / state_district / county
            auto_district = (
                addr.get("state_district")
                or addr.get("district")
                or addr.get("county")
                or addr.get("state")
                or "Unknown District"
            )
        except Exception as geo_err:
            print(f"[Outbreak] Nominatim reverse geocode failed: {geo_err}")

        village = req.village or auto_village
        district = req.district or auto_district

        # 2. Auto-calculate farmers affected in a 5km radius
        affected_count = 0
        from math import radians, cos, sin, asin, sqrt
        tickets_ref2 = db.collection("tickets").stream()
        for ticket in tickets_ref2:
            t_data = ticket.to_dict()
            if t_data.get("disease_name") == req.disease_name:
                t_lat = t_data.get("latitude")
                t_lon = t_data.get("longitude")
                if t_lat is not None and t_lon is not None:
                    lon1, lat1, lon2, lat2 = map(radians, [req.longitude, req.latitude, t_lon, t_lat])
                    dlon = lon2 - lon1
                    dlat = lat2 - lat1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                    c = 2 * asin(sqrt(a))
                    km = 6371 * c
                    if km <= 5.0:
                        affected_count += 1
        
        if affected_count == 0:
            affected_count = 1  # Fallback to at least 1

        outbreak_data = {
            "disease_name": req.disease_name,
            "crop_type": req.crop_type,
            "affected_farmer_count": affected_count,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "district": district,
            "village": village,
            "average_confidence": 1.0,   # Expert-confirmed = 100% confidence
            "reported_by": req.reported_by,
            "notes": req.notes or "",
            "source": "EXPERT_MANUAL",
            "detected_at": datetime.now().isoformat()
        }

        # Write to Firestore outbreaks collection
        doc_ref = db.collection("outbreaks").document()
        doc_ref.set(outbreak_data)

        # Propagate geo-fenced warning to farmers in range
        from services.notification_service import NotificationService
        notifier = NotificationService(db)
        await notifier.notify_farmers_in_radius(
            disease_name=req.disease_name,
            affected_area=f"{village}, {district}",
            severity_level="CRITICAL",
            precautions=req.notes or f"Please inspect your {req.crop_type} fields immediately. An outbreak of {req.disease_name} has been confirmed in your area.",
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=5.0
        )

        # Send Gmail SMTP alert email to RSK admin
        email_service = EmailService()
        email_service.send_alert_notification(
            alert_type="OUTBREAK_WARNING",
            title=f"Confirmed Outbreak: {req.disease_name}",
            message=(
                f"{req.reported_by} confirmed {req.disease_name} on {req.crop_type} in "
                f"{village}, {district}. {affected_count} farmers affected."
                + (f" Notes: {req.notes}" if req.notes else "")
            ),
            severity="CRITICAL",
            location=f"{village}, {district}",
        )

        return {
            "success": True,
            "outbreak_id": doc_ref.id,
            "message": f"Outbreak '{req.disease_name}' registered successfully in {village}, {district}."
        }

    except Exception as e:
        print(f"Error in register_outbreak_manually: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register outbreak: {str(e)}"
        )

