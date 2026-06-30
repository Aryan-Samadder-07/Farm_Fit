import httpx
import random
from typing import Literal

class FarmHealthResult:
    def __init__(
        self,
        health_score: float,
        risk_category: Literal["Healthy", "Warning", "Critical"],
        breakdown: dict,
        explanation: str
    ):
        self.health_score = health_score
        self.risk_category = risk_category
        self.breakdown = breakdown
        self.explanation = explanation

class RiskService:
    async def fetch_historical_weather(self, lat: float, lon: float) -> tuple[float, float]:
        """
        Fetches the cumulative 14-day rainfall (mm) and average daily max temperature (C)
        from the free Open-Meteo API. Falls back to default metrics if unavailable.
        """
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&past_days=14&daily=temperature_2m_max,rain&timezone=auto"
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=5.0)
                if res.status_code == 200:
                    data = res.json()
                    daily = data.get("daily", {})
                    rain_list = daily.get("rain", [])[:14]
                    temp_list = daily.get("temperature_2m_max", [])[:14]
                    
                    rain_val = sum([r for r in rain_list if r is not None])
                    valid_temps = [t for t in temp_list if t is not None]
                    temp_val = sum(valid_temps) / len(valid_temps) if valid_temps else 28.0
                    return rain_val, temp_val
        except Exception as e:
            print(f"[RiskService] Open-Meteo fetch failed: {e}. Using fallback weather.")
        return 20.0, 30.0  # Safe defaults

    async def calculate_health_score(
        self,
        soil_parameters: dict[str, float],
        disease_severity: str | None,
        latitude: float,
        longitude: float,
        previous_diagnoses_count: int = 0
    ) -> FarmHealthResult:
        """
        Calculates the Farm Health Score from 0 to 100 and classifies it.
        Health Score = Base (75) + Soil_Score (up to 25) - Weather_Penalty - Disease_Penalty - History_Penalty
        """
        # 1. Fetch live local weather metrics
        rainfall, avg_temp = await self.fetch_historical_weather(latitude, longitude)
        
        # 2. Evaluate Soil Chemistry Score (Optimal values: pH 5.5-7.5, N 30-80, P 20-50, K 50-120)
        n = soil_parameters.get("N", 0.0)
        p = soil_parameters.get("P", 0.0)
        k = soil_parameters.get("K", 0.0)
        ph = soil_parameters.get("pH", 7.0)
        
        ph_score = 5.0 if 5.5 <= ph <= 7.5 else max(0.0, 5.0 - abs(6.5 - ph))
        n_score = 7.0 if 30 <= n <= 80 else max(0.0, 7.0 - (0.1 * abs(55 - n)))
        p_score = 6.0 if 20 <= p <= 50 else max(0.0, 6.0 - (0.15 * abs(35 - p)))
        k_score = 7.0 if 50 <= k <= 120 else max(0.0, 7.0 - (0.05 * abs(85 - k)))
        
        soil_score = round(ph_score + n_score + p_score + k_score, 1)
        
        # 3. Weather Penalty (Drought, Heat Stress, or Flooding)
        weather_penalty = 0.0
        weather_reason = "Normal regional weather."
        if rainfall < 10.0 and avg_temp >= 38.0:
            weather_penalty = 25.0
            weather_reason = "Critical drought risk (very low rain + high heat)."
        elif rainfall > 250.0:
            weather_penalty = 20.0
            weather_reason = "Flooding hazard (exceeded 250mm cumulative rainfall)."
        elif avg_temp >= 36.0:
            weather_penalty = 12.0
            weather_reason = "Heat stress warnings (average temp above 36C)."
        elif rainfall < 5.0:
            weather_penalty = 8.0
            weather_reason = "Dry soil warning (rainfall below 5mm)."
            
        # 4. Active Disease Severity Penalty
        disease_penalty = 0.0
        sev = (disease_severity or "NONE").upper()
        if sev == "HIGH":
            disease_penalty = 40.0
        elif sev == "MEDIUM":
            disease_penalty = 25.0
        elif sev == "LOW":
            disease_penalty = 10.0
            
        # 5. History Penalty
        history_penalty = min(10.0, float(previous_diagnoses_count) * 2.0)
        
        # 6. Final Calculation
        raw_score = 75.0 + soil_score - weather_penalty - disease_penalty - history_penalty
        health_score = max(0.0, min(100.0, round(raw_score, 1)))
        
        # Risk Categorization
        if health_score >= 80.0:
            risk_category = "Healthy"
        elif health_score >= 50.0:
            risk_category = "Warning"
        else:
            risk_category = "Critical"
            
        # 7. Formulate agronomic explanation (Explainable AI)
        explanation_parts = []
        if disease_penalty > 0:
            explanation_parts.append(f"Active crop disease with {sev} severity (-{int(disease_penalty)} points).")
        if weather_penalty > 0:
            explanation_parts.append(f"{weather_reason} (-{int(weather_penalty)} points).")
        if soil_score < 20.0:
            explanation_parts.append(f"Soil chemistry is sub-optimal (N-P-K-pH score: {soil_score}/25). Check nitrogen/phosphorus levels.")
        else:
            explanation_parts.append(f"Excellent soil chemistry (N-P-K-pH score: {soil_score}/25).")
        if history_penalty > 0:
            explanation_parts.append(f"Recurring crop disease incidents detected in history (-{int(history_penalty)} points).")
            
        explanation = " ".join(explanation_parts)
        
        return FarmHealthResult(
            health_score=health_score,
            risk_category=risk_category,
            breakdown={
                "soil_score": soil_score,
                "weather_penalty": weather_penalty,
                "disease_penalty": disease_penalty,
                "history_penalty": history_penalty,
                "rainfall_14d_mm": round(rainfall, 1),
                "avg_temp_14d_c": round(avg_temp, 1)
            },
            explanation=explanation
        )
