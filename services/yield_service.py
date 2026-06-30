import httpx
from datetime import datetime, timedelta

class YieldPredictionResult:
    def __init__(
        self,
        projected_yield_tonnes: float,
        harvest_date: str,
        estimated_income_inr: float,
        confidence: float,
        breakdown: dict
    ):
        self.projected_yield_tonnes = projected_yield_tonnes
        self.harvest_date = harvest_date
        self.estimated_income_inr = estimated_income_inr
        self.confidence = confidence
        self.breakdown = breakdown

class YieldService:
    async def fetch_rainfall_data(self, lat: float, lon: float) -> float:
        """
        Queries the Open-Meteo forecast API for cumulative 14-day rainfall (mm).
        """
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&past_days=14&daily=rain&timezone=auto"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=5.0)
                if res.status_code == 200:
                    data = res.json()
                    rain_list = data.get("daily", {}).get("rain", [])[:14]
                    return sum([r for r in rain_list if r is not None])
        except Exception:
            pass
        return 50.0  # safe default

    async def predict_yield(
        self,
        crop_name: str,
        soil_parameters: dict[str, float],
        latitude: float,
        longitude: float,
        sowing_date: str,
        farm_size_acres: float = 1.0
    ) -> YieldPredictionResult:
        """
        Predicts crop yield metrics based on soil, weather, crop type, and sowing timelines.
        """
        # 1. Fetch rainfall parameters
        rainfall = await self.fetch_rainfall_data(latitude, longitude)
        
        # 2. Base crop characteristics (Yield per acre in tonnes, price per tonne in INR, growth cycle days)
        crop_db = {
            "tomato": {"base_yield": 8.5, "price_per_tonne": 16000, "cycle_days": 90},
            "rice": {"base_yield": 2.2, "price_per_tonne": 23000, "cycle_days": 120},
            "maize": {"base_yield": 2.8, "price_per_tonne": 20000, "cycle_days": 105},
            "cotton": {"base_yield": 1.2, "price_per_tonne": 68000, "cycle_days": 150},
            "chilli": {"base_yield": 1.0, "price_per_tonne": 130000, "cycle_days": 115},
            "wheat": {"base_yield": 1.8, "price_per_tonne": 25000, "cycle_days": 110}
        }
        
        crop_key = crop_name.lower().strip()
        # Fallback to default if crop is unrecognized
        crop_meta = crop_db.get(crop_key, {"base_yield": 2.0, "price_per_tonne": 22000, "cycle_days": 100})
        
        base_yield = crop_meta["base_yield"]
        price_per_tonne = crop_meta["price_per_tonne"]
        cycle_days = crop_meta["cycle_days"]
        
        # 3. Calculate soil quality factor (deviation from optimal values)
        n = soil_parameters.get("N", 45.0)
        p = soil_parameters.get("P", 30.0)
        k = soil_parameters.get("K", 60.0)
        ph = soil_parameters.get("pH", 6.5)
        
        soil_factor = 1.0
        # pH penalty
        if ph < 5.5 or ph > 7.5:
            soil_factor -= 0.15
        # N penalty
        if n < 25.0:
            soil_factor -= 0.1  # deficient N reduces growth
        # P penalty
        if p < 15.0:
            soil_factor -= 0.1
            
        soil_factor = max(0.5, soil_factor)
        
        # 4. Calculate weather quality factor
        weather_factor = 1.0
        if rainfall < 10.0:
            weather_factor -= 0.2  # drought stress
        elif rainfall > 200.0:
            weather_factor -= 0.15  # flooding stress
            
        weather_factor = max(0.6, weather_factor)
        
        # 5. Predict Yield Tonnage
        projected_yield_per_acre = base_yield * soil_factor * weather_factor
        projected_yield_tonnes = round(projected_yield_per_acre * farm_size_acres, 2)
        
        # 6. Predict Harvest Date
        try:
            parsed_sowing = datetime.strptime(sowing_date, "%Y-%m-%d")
        except ValueError:
            parsed_sowing = datetime.now()
        harvest_dt = parsed_sowing + timedelta(days=cycle_days)
        harvest_date_str = harvest_dt.strftime("%Y-%m-%d")
        
        # 7. Predict Financial Revenue
        estimated_income = round(projected_yield_tonnes * price_per_tonne, 2)
        
        # 8. Calculate Prediction Confidence
        # Higher variation from baseline conditions decreases confidence
        confidence = round(0.95 - (1.0 - soil_factor) - (1.0 - weather_factor), 2)
        confidence = max(0.5, min(0.95, confidence))
        
        return YieldPredictionResult(
            projected_yield_tonnes=projected_yield_tonnes,
            harvest_date=harvest_date_str,
            estimated_income_inr=estimated_income,
            confidence=confidence,
            breakdown={
                "soil_factor": round(soil_factor, 2),
                "weather_factor": round(weather_factor, 2),
                "base_yield_per_acre": base_yield,
                "cumulative_rainfall_mm": round(rainfall, 1)
            }
        )
