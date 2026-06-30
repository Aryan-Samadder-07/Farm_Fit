from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict
from services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/farm", tags=["Farm Analytics Engine"])

class CropHistoryItem(BaseModel):
    season: str
    crop: str
    area_acres: float
    yield_tonnes: float
    market_price_inr: float
    status: str

class DiagnosisTimelineItem(BaseModel):
    ticket_id: str
    date: str
    crop_type: str
    disease_name: str
    confidence: float
    severity_level: str
    status: str

class WeatherTimelineItem(BaseModel):
    month: str
    avg_temp_c: float
    rainfall_mm: float
    humidity_pct: float

class YieldEstimateItem(BaseModel):
    crop: str
    projected_yield_tonnes: float
    harvest_eta_days: int
    confidence: float
    estimated_income_inr: float

class MonthlyTrendItem(BaseModel):
    month: str
    disease_count: int
    resolved_count: int

class FarmHistoryResponse(BaseModel):
    farmer_id: str
    farmer_name: str
    crop_history: List[CropHistoryItem]
    diagnosis_timeline: List[DiagnosisTimelineItem]
    weather_timeline: List[WeatherTimelineItem]
    yield_estimates: List[YieldEstimateItem]
    monthly_trends: List[MonthlyTrendItem]

@router.get("/history/{farmer_id}", response_model=FarmHistoryResponse)
async def get_farmer_history(farmer_id: str):
    try:
        service = AnalyticsService()
        result = await service.get_farm_history(farmer_id)
        return result
    except Exception as e:
        print(f"Error in get_farmer_history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Historical analytics retrieval failed: {str(e)}"
        )
