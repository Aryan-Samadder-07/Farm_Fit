import asyncio
import random
import datetime
import httpx
from google.cloud import firestore

class WeatherAlertService:
    def __init__(self, db: firestore.Client):
        self.db = db

    async def poll_and_update_weather_alerts(self, location_id: str, latitude: float, longitude: float) -> dict | None:
        """
        Polls mock/live weather data for a specific location. Checks if conditions meet 
        a dry-spell pattern (no rain for 14 days + average temperature >= 38°C).
        If matching, upserts a critical alert document in Firestore.
        """
        try:
            # 1. Fetch IMD/Weather data (live API with mock fallback)
            weather_data = await self._fetch_weather_data(latitude, longitude)
            
            daily_rainfall = weather_data.get("daily_rainfall", [])
            temperatures = weather_data.get("temperatures", [])
            
            # Ensure we have at least 14 days of data to check the pattern
            if len(daily_rainfall) < 14 or len(temperatures) < 14:
                return None
                
            total_rainfall_14d = sum(daily_rainfall[:14])
            avg_temperature_14d = sum(temperatures[:14]) / 14
            
            # Check dry-spell pattern: 0mm rainfall in 14 days + high heat (>= 38°C)
            is_dry_spell = (total_rainfall_14d == 0) and (avg_temperature_14d >= 38.0)
            
            if is_dry_spell:
                alert_id = f"dry_spell_{location_id}"
                alert_data = {
                    "alert_id": alert_id,
                    "location_id": location_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "alert_type": "DRY_SPELL",
                    "severity": "HIGH",
                    "description": (
                        f"CRITICAL DRY SPELL: Zero rainfall recorded over the past 14 days "
                        f"with severe average temperatures of {avg_temperature_14d:.1f}°C. "
                        f"Please advise farmers to employ auxiliary irrigation."
                    ),
                    "total_rainfall_14d": total_rainfall_14d,
                    "avg_temp_14d": round(avg_temperature_14d, 2),
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "status": "ACTIVE"
                }
                
                # Update/Create alert in Firestore 'weather_alerts' collection
                alert_ref = self.db.collection("weather_alerts").document(alert_id)
                alert_ref.set(alert_data, merge=True)
                print(f"[WeatherAlertService] Active Dry Spell alert created/updated for {location_id}.")
                return alert_data
            else:
                # If no dry spell exists, check if there was a previous alert and close/resolve it
                alert_id = f"dry_spell_{location_id}"
                alert_ref = self.db.collection("weather_alerts").document(alert_id)
                doc = alert_ref.get()
                if doc.exists and doc.to_dict().get("status") == "ACTIVE":
                    alert_ref.update({
                        "status": "RESOLVED",
                        "resolved_at": firestore.SERVER_TIMESTAMP,
                        "description": "Dry spell resolved: Rain or lower temperatures detected."
                    })
                    print(f"[WeatherAlertService] Dry Spell alert resolved for {location_id}.")
            
            return None
            
        except Exception as e:
            print(f"Error in WeatherAlertService during polling: {e}")
            # Log the error but do not raise, keeping the background loop running
            return None

    async def _fetch_weather_data(self, latitude: float, longitude: float) -> dict:
        """
        Fetches historical 14-day weather metrics from the free Open-Meteo API.
        Falls back to a local mock generator if the request fails or times out.
        """
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={latitude}&longitude={longitude}"
            f"&past_days=14&daily=temperature_2m_max,rain&timezone=auto"
        )
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    daily = data.get("daily", {})
                    # The response includes the 14 past days + today + future forecast days.
                    # We take the first 14 elements corresponding to the past 14 days.
                    rain = daily.get("rain", [])[:14]
                    temps = daily.get("temperature_2m_max", [])[:14]
                    
                    # Ensure we have valid float values (converting None to 0.0)
                    rain = [r if r is not None else 0.0 for r in rain]
                    temps = [t if t is not None else 30.0 for t in temps]
                    
                    if len(rain) >= 14 and len(temps) >= 14:
                        print(f"[WeatherAlertService] Successfully fetched live weather data from Open-Meteo for {latitude}, {longitude}.")
                        return {
                            "daily_rainfall": rain,
                            "temperatures": temps
                        }
        except Exception as e:
            print(f"[WeatherAlertService] API fetch failed ({e}). Falling back to mock generator...")
        
        # Generate weather metrics fallback:
        # If latitude contains decimal ending in 0.5 or 0.0, trigger dry spell, otherwise randomize
        if int(latitude * 10) % 5 == 0:
            # Consistent dry spell
            return {
                "daily_rainfall": [0.0] * 14,
                "temperatures": [39.0 + random.uniform(-1, 2) for _ in range(14)]
            }
        else:
            # Normal weather
            return {
                "daily_rainfall": [random.choice([0.0, 0.0, 0.0, 5.2, 10.0, 0.0]) for _ in range(14)],
                "temperatures": [28.0 + random.uniform(-2, 5) for _ in range(14)]
            }

    async def start_polling_loop(self, locations: list[dict], interval_seconds: int = 3600):
        """
        Runs a persistent background loop polling weather metrics for specified locations.
        """
        print(f"[WeatherAlertService] Starting weather alert polling scheduler (interval: {interval_seconds}s)...")
        while True:
            for loc in locations:
                loc_id = loc.get("location_id", "unknown")
                lat = loc.get("lat", 0.0)
                lon = loc.get("lon", 0.0)
                await self.poll_and_update_weather_alerts(loc_id, lat, lon)
            await asyncio.sleep(interval_seconds)
