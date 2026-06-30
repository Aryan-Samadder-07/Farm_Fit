from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict
from services.scheme_service import SchemeService

router = APIRouter(prefix="/api/v1/government", tags=["Government Scheme Intelligence"])

class GovernmentSchemeItem(BaseModel):
    scheme_name: str
    benefit: str
    eligibility: str
    description: str
    documents_required: List[str]

class GovernmentSchemesResponse(BaseModel):
    schemes: List[GovernmentSchemeItem] = Field(..., description="Matched subsidy and investment schemes")

@router.get("/schemes", response_model=GovernmentSchemesResponse)
async def get_recommended_schemes(
    farmer_name: str = "Ramesh Kurva",
    crop_type: str = "Tomato",
    farm_size_acres: float = 1.5,
    location_id: str = "AP_Nellore"
):
    try:
        service = SchemeService()
        schemes = service.get_matching_schemes(
            farmer_name=farmer_name,
            crop_type=crop_type,
            farm_size_acres=farm_size_acres,
            location_id=location_id
        )
        return {"schemes": schemes}
    except Exception as e:
        print(f"Error in get_recommended_schemes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Schemes recommendation engine failed: {str(e)}"
        )
