from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict
from services.market_service import MarketService

router = APIRouter(prefix="/api/v1/market", tags=["Market Mandi Intelligence"])

class MandiPrices(BaseModel):
    average_price_per_quintal: float
    price_range_min: float
    price_range_max: float
    msp_comparison: float | None

class LogisticsInfo(BaseModel):
    nearest_mandi_name: str
    distance_km: float

class MandiAnalytics(BaseModel):
    trend: str
    optimal_selling_window_forecast: str

class MarketIntelligenceResponse(BaseModel):
    crop_name: str
    market_prices: MandiPrices
    logistics: LogisticsInfo
    market_analytics: MandiAnalytics

@router.get("/prices", response_model=MarketIntelligenceResponse)
async def get_mandi_market_prices(
    crop_name: str = "Tomato",
    location_id: str = "AP_Nellore"
):
    try:
        service = MarketService()
        result = service.get_market_intelligence(
            crop_name=crop_name,
            location_id=location_id
        )
        return result
    except Exception as e:
        print(f"Error in get_mandi_market_prices: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Market price analytics retrieval failed: {str(e)}"
        )
