from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any
from services.gis_service import GISService

router = APIRouter(prefix="/api/v1/dashboard", tags=["GIS Map Layer Engine"])

@router.get("/maps")
async def get_gis_map_layers() -> Dict[str, Any]:
    try:
        service = GISService()
        layers = await service.get_full_map_layers()
        return layers
    except Exception as e:
        print(f"Error in get_gis_map_layers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GIS layer generation failed: {str(e)}"
        )

@router.get("/maps/farmers")
async def get_farmer_locations() -> Dict[str, Any]:
    try:
        service = GISService()
        return await service.get_farmer_locations_layer()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/maps/outbreaks")
async def get_outbreak_clusters() -> Dict[str, Any]:
    try:
        service = GISService()
        return await service.get_outbreak_clusters_layer()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
