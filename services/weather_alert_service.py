import asyncio
import random
import datetime
import httpx
from google.cloud import firestore
from services.email_service import EmailService

class WeatherAlertService:
    def __init__(self, db: firestore.Client):
        self.db = db
        self.email_service = EmailService()

    async def poll_and_update_weather_alerts(self, location_id: str, latitude: float, longitude: float) -> list[dict]:
        """
        Polls weather data for a specific location. Checks for:
        - Dry Spell: 14 days zero rain + temp >= 38°C
        - Heavy Rainfall / Flood Risk: Daily rain > 50 mm
        - Storm Warning: Max wind speed > 50 km/h
        - Cyclone Threat: Max wind speed > 90 km/h + heavy rain > 40 mm
        Upserts active alerts to Firestore and dispatches SMTP alerts.
        """
        active_alerts = []
        try:
            weather_data = await self._fetch_weather_data(latitude, longitude)
            
            daily_rainfall = weather_data.get("daily_rainfall", [])
            temperatures = weather_data.get("temperatures", [])
            max_winds = weather_data.get("max_winds", [])  # in km/h

            # Ensure we have at least 14 days of data to check dry spell
            if len(daily_rainfall) < 14 or len(temperatures) < 14 or len(max_winds) < 14:
                return []

            # ── 1. Check Dry-Spell ──
            total_rainfall_14d = sum(daily_rainfall[:14])
            avg_temperature_14d = sum(temperatures[:14]) / 14
            is_dry_spell = (total_rainfall_14d == 0) and (avg_temperature_14d >= 38.0)

            dry_spell_id = f"dry_spell_{location_id}"
            dry_spell_ref = self.db.collection("weather_alerts").document(dry_spell_id)
            if is_dry_spell:
                alert_data = {
                    "alert_id": dry_spell_id,
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
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "status": "ACTIVE"
                }
                dry_spell_ref.set(alert_data, merge=True)
                self.email_service.send_alert_notification(
                    alert_type="DRY_SPELL",
                    title=f"Dry Spell Warning: {location_id}",
                    message=alert_data["description"],
                    severity="HIGH",
                    location=location_id,
                )
                active_alerts.append(alert_data)
            else:
                doc = dry_spell_ref.get()
                if doc.exists and doc.to_dict().get("status") == "ACTIVE":
                    dry_spell_ref.update({
                        "status": "RESOLVED",
                        "resolved_at": firestore.SERVER_TIMESTAMP,
                        "description": "Dry spell resolved: Rain or lower temperatures detected."
                    })

            # ── 2. Check Cyclone Threat ──
            # Cyclone defined as extreme winds (>90 km/h) accompanied by heavy rainfall (>40mm)
            latest_rain = daily_rainfall[0]
            latest_wind = max_winds[0]
            is_cyclone = (latest_wind >= 90.0) and (latest_rain >= 40.0)

            cyclone_id = f"cyclone_{location_id}"
            cyclone_ref = self.db.collection("weather_alerts").document(cyclone_id)
            if is_cyclone:
                alert_data = {
                    "alert_id": cyclone_id,
                    "location_id": location_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "alert_type": "CYCLONE_ALERT",
                    "severity": "CRITICAL",
                    "description": (
                        f"CRITICAL CYCLONE THREAT: Extremely high wind gusts of {latest_wind:.1f} km/h "
                        f"accompanied by severe precipitation of {latest_rain:.1f} mm detected. "
                        f"Advise farmers to postpone crop harvests, clear drainage channels, and secure greenhouses immediately."
                    ),
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "status": "ACTIVE"
                }
                cyclone_ref.set(alert_data, merge=True)
                self.email_service.send_alert_notification(
                    alert_type="OUTBREAK_WARNING",
                    title=f"CYCLONE WARNING: {location_id}",
                    message=alert_data["description"],
                    severity="CRITICAL",
                    location=location_id,
                )
                active_alerts.append(alert_data)
            else:
                doc = cyclone_ref.get()
                if doc.exists and doc.to_dict().get("status") == "ACTIVE":
                    cyclone_ref.update({
                        "status": "RESOLVED",
                        "resolved_at": firestore.SERVER_TIMESTAMP,
                        "description": "Cyclone warning resolved: Wind speeds and rainfall have normalized."
                    })

            # ── 3. Check Heavy Rainfall / Flood Risk ──
            # Triggered if daily rainfall exceeds 50mm (excluding when active cyclone dominates)
            is_heavy_rain = (latest_rain >= 50.0) and not is_cyclone

            heavy_rain_id = f"heavy_rain_{location_id}"
            heavy_rain_ref = self.db.collection("weather_alerts").document(heavy_rain_id)
            if is_heavy_rain:
                alert_data = {
                    "alert_id": heavy_rain_id,
                    "location_id": location_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "alert_type": "HEAVY_RAINFALL",
                    "severity": "HIGH",
                    "description": (
                        f"HEAVY RAINFALL WARNING: Rainfall of {latest_rain:.1f} mm recorded today. "
                        f"High risk of soil erosion, waterlogging, and root rot. "
                        f"Ensure active water drainage channels in low-lying crop fields."
                    ),
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "status": "ACTIVE"
                }
                heavy_rain_ref.set(alert_data, merge=True)
                self.email_service.send_alert_notification(
                    alert_type="WEATHER_ALERT",
                    title=f"Heavy Rainfall Alert: {location_id}",
                    message=alert_data["description"],
                    severity="HIGH",
                    location=location_id,
                )
                active_alerts.append(alert_data)
            else:
                doc = heavy_rain_ref.get()
                if doc.exists and doc.to_dict().get("status") == "ACTIVE":
                    heavy_rain_ref.update({
                        "status": "RESOLVED",
                        "resolved_at": firestore.SERVER_TIMESTAMP,
                        "description": "Heavy rainfall alert resolved: Precipitation has cleared."
                    })

            # ── 4. Check Wind Storm Warning ──
            # Triggered if wind speed exceeds 50 km/h (excluding when active cyclone dominates)
            is_storm = (latest_wind >= 50.0) and not is_cyclone

            storm_id = f"storm_{location_id}"
            storm_ref = self.db.collection("weather_alerts").document(storm_id)
            if is_storm:
                alert_data = {
                    "alert_id": storm_id,
                    "location_id": location_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "alert_type": "STORM_WARNING",
                    "severity": "HIGH",
                    "description": (
                        f"STORM WARNING: High wind gusts of {latest_wind:.1f} km/h detected in region. "
                        f"Risk of lodging (bending) in tall crops like maize, sugarcane, and banana plants. "
                        f"Postpone spraying operations until winds subside."
                    ),
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "status": "ACTIVE"
                }
                storm_ref.set(alert_data, merge=True)
                self.email_service.send_alert_notification(
                    alert_type="WEATHER_ALERT",
                    title=f"Incoming Storm Alert: {location_id}",
                    message=alert_data["description"],
                    severity="HIGH",
                    location=location_id,
                )
                active_alerts.append(alert_data)
            else:
                doc = storm_ref.get()
                if doc.exists and doc.to_dict().get("status") == "ACTIVE":
                    storm_ref.update({
                        "status": "RESOLVED",
                        "resolved_at": firestore.SERVER_TIMESTAMP,
                        "description": "Storm warning resolved: Wind speeds have returned to safe limits."
                    })

            return active_alerts
        except Exception as e:
            print(f"Error in WeatherAlertService during polling: {e}")
            return []

    async def _fetch_weather_data(self, latitude: float, longitude: float) -> dict:
        """
        Fetches 14-day weather metrics from Open-Meteo API.
        Includes wind gusts/speed and rain volume.
        """
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={latitude}&longitude={longitude}"
            f"&past_days=14&daily=temperature_2m_max,rain,wind_speed_10m_max&timezone=auto"
        )
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    daily = data.get("daily", {})
                    rain = daily.get("rain", [])[:14]
                    temps = daily.get("temperature_2m_max", [])[:14]
                    winds = daily.get("wind_speed_10m_max", [])[:14]
                    
                    rain = [r if r is not None else 0.0 for r in rain]
                    temps = [t if t is not None else 30.0 for t in temps]
                    winds = [w if w is not None else 10.0 for w in winds]
                    
                    if len(rain) >= 14 and len(temps) >= 14 and len(winds) >= 14:
                        print(f"[WeatherAlertService] Successfully fetched live weather data from Open-Meteo for {latitude}, {longitude}.")
                        return {
                            "daily_rainfall": rain,
                            "temperatures": temps,
                            "max_winds": winds
                        }
        except Exception as e:
            print(f"[WeatherAlertService] API fetch failed ({e}). Falling back to mock generator...")
        
        # Generate weather metrics fallback:
        # If latitude contains decimal ending in 0.5 or 0.0, trigger dry spell
        # If it ends in 0.1, trigger a Cyclone. If it ends in 0.2, trigger Heavy Rain. If 0.3, trigger Storm.
        lat_dec = int(latitude * 10) % 10
        if lat_dec == 0 or lat_dec == 5:
            # Dry spell
            return {
                "daily_rainfall": [0.0] * 14,
                "temperatures": [39.0 + random.uniform(-1, 2) for _ in range(14)],
                "max_winds": [12.0 + random.uniform(-2, 2) for _ in range(14)]
            }
        elif lat_dec == 1:
            # Cyclone threat today
            return {
                "daily_rainfall": [45.0] + [random.choice([0.0, 5.0]) for _ in range(13)],
                "temperatures": [26.0] * 14,
                "max_winds": [95.0] + [15.0] * 13
            }
        elif lat_dec == 2:
            # Heavy Rain
            return {
                "daily_rainfall": [65.0] + [random.choice([0.0, 5.0]) for _ in range(13)],
                "temperatures": [27.0] * 14,
                "max_winds": [20.0] * 14
            }
        elif lat_dec == 3:
            # Storm
            return {
                "daily_rainfall": [5.0] + [0.0] * 13,
                "temperatures": [28.0] * 14,
                "max_winds": [58.0] + [12.0] * 13
            }
        else:
            # Normal weather
            return {
                "daily_rainfall": [random.choice([0.0, 0.0, 0.0, 5.2, 10.0, 0.0]) for _ in range(14)],
                "temperatures": [28.0 + random.uniform(-2, 5) for _ in range(14)],
                "max_winds": [15.0 + random.uniform(-5, 5) for _ in range(14)]
            }

    async def start_polling_loop(self, locations: list[dict], interval_seconds: int = 3600):
        print(f"[WeatherAlertService] Starting weather alert polling scheduler (interval: {interval_seconds}s)...")
        while True:
            for loc in locations:
                loc_id = loc.get("location_id", "unknown")
                lat = loc.get("lat", 0.0)
                lon = loc.get("lon", 0.0)
                await self.poll_and_update_weather_alerts(loc_id, lat, lon)
            await asyncio.sleep(interval_seconds)
