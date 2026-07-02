from typing import Dict, Any
from config import settings
import logging

logger = logging.getLogger("market_service")

class MarketService:
    def get_market_intelligence(self, crop_name: str, location_id: str) -> Dict[str, Any]:
        """
        Retrieves live APMC Mandi rates, MSP standards, closest market yards, 
        and predictive selling windows. Connects to Government of India data.gov.in API
        if credentials are set; otherwise defaults to static local APMC database.
        """
        # Clean the crop name of any fallback debugging suffixes
        crop_name_clean = crop_name.replace(" (AI Fallback Mode)", "").strip()
        crop_key = crop_name_clean.lower().strip()
        location_lower = location_id.lower()
        
        # 1. Base Local Database
        mandi_db = {
            "tomato": {
                "avg_price_quintal": 2200.0,
                "range_min": 1800.0,
                "range_max": 2500.0,
                "msp_price_quintal": None,
                "nearest_mandi": "Nellore Market Yard",
                "price_trend": "Increasing",
                "sell_forecast": "Stable - Hold crop for 8-12 days to maximize pricing windows.",
                "market_distance_km": 14.5
            },
            "rice": {
                "avg_price_quintal": 2250.0,
                "range_min": 2150.0,
                "range_max": 2400.0,
                "msp_price_quintal": 2183.0,
                "nearest_mandi": "Guntur APMC Grain Market",
                "price_trend": "Stable",
                "sell_forecast": "Favorable - Local mandi pricing is trading above MSP. Sell now.",
                "market_distance_km": 28.2
              },
            "cotton": {
                "avg_price_quintal": 7100.0,
                "range_min": 6500.0,
                "range_max": 7500.0,
                "msp_price_quintal": 6620.0,
                "nearest_mandi": "Adoni Cotton Market Yard",
                "price_trend": "Increasing",
                "sell_forecast": "Highly Favorable - Export demand is strong. Sell within 14 days.",
                "market_distance_km": 42.0
            },
            "maize": {
                "avg_price_quintal": 2050.0,
                "range_min": 1900.0,
                "range_max": 2150.0,
                "msp_price_quintal": 2090.0,
                "nearest_mandi": "Kurnool Grain Mandi",
                "price_trend": "Decreasing",
                "sell_forecast": "Hold - Current arrivals are heavy. Store grain for 30 days.",
                "market_distance_km": 18.0
            },
            "chilli": {
                "avg_price_quintal": 18500.0,
                "range_min": 16000.0,
                "range_max": 21000.0,
                "msp_price_quintal": None,
                "nearest_mandi": "Guntur Mirchi Yard (Largest Chilli Mandi)",
                "price_trend": "Increasing",
                "sell_forecast": "Stable - Favorable exports. Ideal sell window open.",
                "market_distance_km": 35.5
            }
        }
        
        market_intel = mandi_db.get(crop_key, {
            "avg_price_quintal": 2000.0,
            "range_min": 1800.0,
            "range_max": 2200.0,
            "msp_price_quintal": None,
            "nearest_mandi": "District APMC Mandi",
            "price_trend": "Stable",
            "sell_forecast": "Stable - Normal seasonal market arrivals.",
            "market_distance_km": 15.0
        })

        # 2. Try querying Live Agmarknet API (data.gov.in) if key is set
        if settings.DATA_GOV_IN_API_KEY:
            try:
                import httpx
                # Resource ID for live daily Agmarknet market commodity prices & arrivals
                url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a8645436d318"
                params = {
                    "api-key": settings.DATA_GOV_IN_API_KEY,
                    "format": "json",
                    "filters[commodity]": crop_name_clean.title(),
                    "limit": 5
                }
                
                # Fetch synchronously to match current method structure
                with httpx.Client(timeout=6.0) as client:
                    response = client.get(url, params=params)
                    if response.status_code == 200:
                        payload = response.json()
                        records = payload.get("records", [])
                        if records:
                            rec = records[0]
                            market_name = f"{rec.get('market', 'Local APMC')} Mandi ({rec.get('district', 'District')})"
                            
                            try:
                                avg_price = float(rec.get("modal_price", market_intel["avg_price_quintal"]))
                                min_p = float(rec.get("min_price", market_intel["range_min"]))
                                max_p = float(rec.get("max_price", market_intel["range_max"]))
                            except (ValueError, TypeError):
                                avg_price = market_intel["avg_price_quintal"]
                                min_p = market_intel["range_min"]
                                max_p = market_intel["range_max"]

                            market_intel = {
                                "avg_price_quintal": avg_price,
                                "range_min": min_p,
                                "range_max": max_p,
                                "msp_price_quintal": market_intel["msp_price_quintal"],
                                "nearest_mandi": market_name,
                                "price_trend": "Increasing" if avg_price > market_intel["avg_price_quintal"] else "Stable",
                                "sell_forecast": f"Live Agmarknet pricing active. Direct APMC arrivals logged on {rec.get('arrival_date', 'today')}.",
                                "market_distance_km": 12.0
                            }
                            logger.info(f"[MarketService] Retrieved live Agmarknet prices for {crop_name_clean}: {avg_price} INR/Qtl")
            except Exception as e:
                logger.warning(f"[MarketService] Failed to fetch live mandi rates from data.gov.in: {e}. Falling back to default DB.")

        # Override nearest mandi based on location keyword if matches Guntur (fallback helper)
        if "guntur" in location_lower and crop_key == "tomato" and not settings.DATA_GOV_IN_API_KEY:
            market_intel["nearest_mandi"] = "Guntur Tomato Yard"
            market_intel["market_distance_km"] = 8.4
            
        return {
            "crop_name": crop_name_clean,
            "market_prices": {
                "average_price_per_quintal": market_intel["avg_price_quintal"],
                "price_range_min": market_intel["range_min"],
                "price_range_max": market_intel["range_max"],
                "msp_comparison": market_intel["msp_price_quintal"]
            },
            "logistics": {
                "nearest_mandi_name": market_intel["nearest_mandi"],
                "distance_km": market_intel["market_distance_km"]
            },
            "market_analytics": {
                "trend": market_intel["price_trend"],
                "optimal_selling_window_forecast": market_intel["sell_forecast"]
            }
        }
