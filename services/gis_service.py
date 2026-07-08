from google.cloud import firestore
from typing import Dict, Any
from db import get_db

class GISService:
    def __init__(self, db: firestore.Client | None = None):
        self.db = db or get_db()

    async def get_farmer_locations_layer(self) -> Dict[str, Any]:
        """
        Builds a GeoJSON FeatureCollection containing individual farmer ticket locations.
        """
        docs = self.db.collection("tickets").limit(100).stream()
        features = []
        idx = 0
        
        for doc in docs:
            data = doc.to_dict()
            lat = data.get("latitude")
            lon = data.get("longitude")
            if lat is None or lon is None:
                continue
            
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                },
                "properties": {
                    "id": doc.id,
                    "farmer_name": data.get("farmer_name", "Anonymous"),
                    "crop_type": data.get("crop_type", "Unknown"),
                    "disease_name": data.get("disease_name", "Unknown"),
                    "severity_level": data.get("severity_level", "LOW"),
                    "status": data.get("status", "PENDING"),
                    "confidence": data.get("confidence", 0.0)
                }
            })
            idx += 1

        # Fallback mock farmer points if DB is empty
        if not features:
            features = self._mock_farmer_features()

        return {"type": "FeatureCollection", "features": features}

    async def get_outbreak_clusters_layer(self) -> Dict[str, Any]:
        """
        Builds a GeoJSON FeatureCollection containing detected disease outbreak cluster centres.
        """
        docs = self.db.collection("outbreaks").limit(50).stream()
        features = []

        for doc in docs:
            data = doc.to_dict()
            lat = data.get("latitude")
            lon = data.get("longitude")
            if lat is None or lon is None:
                continue
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat]
                },
                "properties": {
                    "disease_name": data.get("disease_name", "Unknown"),
                    "village": data.get("village") or data.get("village_name") or "—",
                    "district": data.get("district") or "—",
                    "affected_farmer_count": data.get("affected_farmer_count", 0),
                    "average_confidence": data.get("average_confidence", 0.0)
                }
            })

        # Fallback mock outbreak clusters
        if not features:
            features = [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [79.9912, 14.4625]},
                    "properties": {
                        "disease_name": "Tomato Late Blight",
                        "village": "Podalakur Mandal",
                        "district": "SPSR Nellore",
                        "affected_farmer_count": 6,
                        "average_confidence": 0.92
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [79.9654, 14.4215]},
                    "properties": {
                        "disease_name": "Rice Blast",
                        "village": "Indukurpet Mandal",
                        "district": "SPSR Nellore",
                        "affected_farmer_count": 4,
                        "average_confidence": 0.86
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [79.9421, 14.4918]},
                    "properties": {
                        "disease_name": "Cotton Bollworm",
                        "village": "Kovur Mandal",
                        "district": "SPSR Nellore",
                        "affected_farmer_count": 3,
                        "average_confidence": 0.78
                    }
                }
            ]

        return {"type": "FeatureCollection", "features": features}

    async def get_full_map_layers(self) -> Dict[str, Any]:
        """
        Returns all GIS layers bundled together for a single-request map load.
        Computes map center dynamically from actual data centroid.
        """
        farmer_layer = await self.get_farmer_locations_layer()
        outbreak_layer = await self.get_outbreak_clusters_layer()

        # Compute centroid from all available data points
        all_lats = []
        all_lons = []
        for f in farmer_layer.get("features", []):
            coords = f.get("geometry", {}).get("coordinates", [])
            if len(coords) == 2:
                all_lons.append(coords[0])
                all_lats.append(coords[1])
        for f in outbreak_layer.get("features", []):
            coords = f.get("geometry", {}).get("coordinates", [])
            if len(coords) == 2:
                all_lons.append(coords[0])
                all_lats.append(coords[1])

        if all_lats and all_lons:
            center_lat = sum(all_lats) / len(all_lats)
            center_lon = sum(all_lons) / len(all_lons)
        else:
            # No real data yet — use a neutral India-centre fallback
            center_lat = 20.5937
            center_lon = 78.9629

        return {
            "farmer_locations": farmer_layer,
            "outbreak_clusters": outbreak_layer,
            "center": {
                "lat": center_lat,
                "lon": center_lon
            }
        }

    def _mock_farmer_features(self):
        """Generates realistic fallback farmer geo-points around Nellore, AP."""
        offsets = [
            (0.01, 0.02, "Ramesh Kurva", "Tomato", "Late Blight", "HIGH"),
            (-0.02, 0.01, "Srinivas Rao", "Rice", "Rice Blast", "HIGH"),
            (0.03, -0.01, "Chandra Babu", "Cotton", "Leaf Blight", "MEDIUM"),
            (-0.01, -0.03, "Venkatesh Prasad", "Maize", "Healthy Plant", "LOW"),
            (0.04, 0.02, "Bala Krishna", "Chilli", "Fusarium Wilt", "HIGH"),
        ]
        return [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [79.9865 + dlat, 14.4426 + dlon]
                },
                "properties": {
                    "id": f"mock_{i}",
                    "farmer_name": name,
                    "crop_type": crop,
                    "disease_name": disease,
                    "severity_level": sev,
                    "status": "PENDING",
                    "confidence": 0.90
                }
            }
            for i, (dlat, dlon, name, crop, disease, sev) in enumerate(offsets)
        ]
