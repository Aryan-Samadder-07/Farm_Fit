from dotenv import load_dotenv
load_dotenv()

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import expert, diagnosis, agronomy, risk, history, yield_route, knowledge, government, market, outbreak, gis
from services.weather_alert_service import WeatherAlertService
from db import get_db

# Mock regional centers (RSKs) in Andhra Pradesh, India to poll weather for
POLL_LOCATIONS = [
    {"location_id": "RSK_Nellore", "lat": 14.44, "lon": 79.98},
    {"location_id": "RSK_Anantapur", "lat": 14.68, "lon": 77.60},  # Mock lat/lon to trigger dry spell
    {"location_id": "RSK_Kurnool", "lat": 15.80, "lon": 78.05},
    {"location_id": "RSK_Guntur", "lat": 16.30, "lon": 80.43}
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the FastAPI lifespan events: registers the background weather 
    polling worker on startup, and gracefully terminates it on shutdown.
    """
    db = get_db()
    weather_service = WeatherAlertService(db)
    
    # Initialize background worker loop running every 60 seconds for demonstration 
    # (Typically runs hourly or daily in production)
    polling_task = asyncio.create_task(
        weather_service.start_polling_loop(POLL_LOCATIONS, interval_seconds=60)
    )
    
    yield  # Application runs here
    
    # Graceful shutdown cancellation of background tasks
    polling_task.cancel()
    try:
        await polling_task
    except asyncio.CancelledError:
        print("[System] Background weather polling task stopped.")

app = FastAPI(
    title="Kisan Alert - Intelligence & Expert System API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware to allow cross-origin requests from the React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; in production specify domain
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints
app.include_router(expert.router)
app.include_router(diagnosis.router)
app.include_router(agronomy.router)
app.include_router(risk.router)
app.include_router(history.router)
app.include_router(yield_route.router)
app.include_router(knowledge.router)
app.include_router(government.router)
app.include_router(market.router)
app.include_router(outbreak.router)
app.include_router(gis.router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "Kisan Alert Intelligence & Expert System API is running."
    }

