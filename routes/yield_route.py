from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict
from services.yield_service import YieldService

router = APIRouter(prefix="/api/v1/yield", tags=["Yield Prediction Engine"])

class YieldPredictionRequest(BaseModel):
    crop_name: str = Field(..., description="Crop name, e.g. 'Tomato', 'Rice', 'Cotton'")
    soil_parameters: Dict[str, float] = Field(
        ...,
        description="Soil characteristics dictionary. E.g. {'N': 45.0, 'P': 30.0, 'K': 65.0, 'pH': 6.5}"
    )
    latitude: float = Field(..., description="Latitude of the farm location")
    longitude: float = Field(..., description="Longitude of the farm location")
    sowing_date: str = Field(..., description="Sowing date in YYYY-MM-DD format")
    farm_size_acres: float = Field(1.0, description="Size of the cultivated land in acres")

class YieldPredictionResponse(BaseModel):
    projected_yield_tonnes: float = Field(..., description="Estimated total harvest yield in tonnes")
    harvest_date: str = Field(..., description="Estimated crop harvest date (YYYY-MM-DD)")
    estimated_income_inr: float = Field(..., description="Estimated crop revenue in INR")
    confidence: float = Field(..., description="Yield prediction confidence value between 0.0 and 1.0")
    breakdown: Dict = Field(..., description="Breakdown of soil, weather multipliers and rainfall metrics")

@router.post("/predict", response_model=YieldPredictionResponse)
async def predict_crop_yield(payload: YieldPredictionRequest):
    try:
        service = YieldService()
        result = await service.predict_yield(
            crop_name=payload.crop_name,
            soil_parameters=payload.soil_parameters,
            latitude=payload.latitude,
            longitude=payload.longitude,
            sowing_date=payload.sowing_date,
            farm_size_acres=payload.farm_size_acres
        )
        return {
            "projected_yield_tonnes": result.projected_yield_tonnes,
            "harvest_date": result.harvest_date,
            "estimated_income_inr": result.estimated_income_inr,
            "confidence": result.confidence,
            "breakdown": result.breakdown
        }
    except Exception as e:
        print(f"Error in predict_crop_yield: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yield prediction computation failed: {str(e)}"
        )
