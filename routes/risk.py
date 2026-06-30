from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict
from services.risk_service import RiskService

router = APIRouter(prefix="/api/v1/risk", tags=["Risk Analysis Engine"])

class RiskAnalysisRequest(BaseModel):
    soil_parameters: Dict[str, float] = Field(
        ...,
        description="Soil chemical markers: N, P, K (mg/kg) and pH. E.g. {'N': 45.0, 'P': 30.0, 'K': 60.0, 'pH': 6.5}"
    )
    disease_severity: Optional[str] = Field(
        None,
        description="Active crop disease severity level: 'LOW', 'MEDIUM', 'HIGH', or None"
    )
    latitude: float = Field(..., description="Latitude of the farm location")
    longitude: float = Field(..., description="Longitude of the farm location")
    previous_diagnoses_count: int = Field(0, description="Count of historical disease events registered for this farm")

class RiskAnalysisResponse(BaseModel):
    health_score: float = Field(..., description="Calculated overall farm health score between 0.0 and 100.0")
    risk_category: str = Field(..., description="Derived risk category: 'Healthy', 'Warning', or 'Critical'")
    breakdown: Dict = Field(..., description="Breakdown of score components and weather measurements")
    explanation: str = Field(..., description="Agronomic explanation of the score deductions")

@router.post("/analyze", response_model=RiskAnalysisResponse)
async def analyze_farm_risk(payload: RiskAnalysisRequest):
    try:
        service = RiskService()
        result = await service.calculate_health_score(
            soil_parameters=payload.soil_parameters,
            disease_severity=payload.disease_severity,
            latitude=payload.latitude,
            longitude=payload.longitude,
            previous_diagnoses_count=payload.previous_diagnoses_count
        )
        return {
            "health_score": result.health_score,
            "risk_category": result.risk_category,
            "breakdown": result.breakdown,
            "explanation": result.explanation
        }
    except Exception as e:
        print(f"Error in analyze_farm_risk: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Risk analysis calculation failed: {str(e)}"
        )
