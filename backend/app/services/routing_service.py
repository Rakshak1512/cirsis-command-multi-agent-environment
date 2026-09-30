import math
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory route cache: (rounded_coords_tuple) -> route_dict
_ROUTE_CACHE: Dict[str, Dict[str, Any]] = {}

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes exact spherical great-circle distance in kilometers."""
    R = 6371.0 # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def _generate_synthetic_waypoints(
    start_lat: float, start_lng: float, dest_lat: float, dest_lng: float, steps: int = 12
) -> List[List[float]]:
    """Generates realistic street-grid style waypoint coordinates for map visualization."""
    coords = []
    mid_lat = (start_lat + dest_lat) / 2.0
    mid_lng = (start_lng + dest_lng) / 2.0
    offset = 0.0015

    for i in range(steps + 1):
        t = i / steps
        if t < 0.5:
            s = t * 2
            lat = start_lat + s * (mid_lat + offset - start_lat)
            lng = start_lng + s * (mid_lng - offset - start_lng)
        else:
            s = (t - 0.5) * 2
            lat = (mid_lat + offset) + s * (dest_lat - (mid_lat + offset))
            lng = (mid_lng - offset) + s * (dest_lng - (mid_lng - offset))
        coords.append([round(lat, 6), round(lng, 6)])
    return coords

class RoutingService:
    """
    OpenStreetMap-compatible routing service.
    Configurable via settings.ROUTING_PROVIDER ('osrm', 'haversine', etc.)
    Provides deterministic distance, ETA, and route coordinates.
    """

    def __init__(self, provider: Optional[str] = None):
        self.provider = (provider or getattr(settings, "ROUTING_PROVIDER", "osrm")).lower()

    def calculate_distance(
        self, start_lat: float, start_lng: float, dest_lat: float, dest_lng: float
    ) -> float:
        """
        Calculates distance in kilometers between two coordinates.
        Uses deterministic haversine or cached OSRM route distance.
        """
        if abs(start_lat - dest_lat) < 1e-6 and abs(start_lng - dest_lng) < 1e-6:
            return 0.0

        cache_key = f"{round(start_lat, 4)},{round(start_lng, 4)}->{round(dest_lat, 4)},{round(dest_lng, 4)}"
        if cache_key in _ROUTE_CACHE:
            return _ROUTE_CACHE[cache_key]["distance_km"]

        return _haversine_distance(start_lat, start_lng, dest_lat, dest_lng)

    def calculate_eta(
        self, distance_km: float, resource_type: Optional[str] = None, is_emergency: bool = True
    ) -> float:
        """
        Calculates realistic emergency ETA in minutes based on distance and vehicle dynamics.
        Deterministic: Avoids arbitrary or LLM hallucinated time values.
        """
        if distance_km <= 0.05:
            return 1.0

        type_str = str(resource_type).lower() if resource_type else ""
        if "ambulance" in type_str:
            avg_speed = 45.0 if is_emergency else 30.0
        elif "fire" in type_str:
            avg_speed = 38.0 if is_emergency else 25.0
        elif "hospital" in type_str:
            avg_speed = 40.0
        else:
            avg_speed = 35.0

        travel_time_min = (distance_km / avg_speed) * 60.0
        dispatch_latency = 1.0  # 1 minute standard response latency
        total_eta = travel_time_min + dispatch_latency
        return round(max(total_eta, 1.5), 1)

    def calculate_route(
        self,
        start_lat: float,
        start_lng: float,
        dest_lat: float,
        dest_lng: float,
        resource_type: Optional[str] = None,
        is_emergency: bool = True,
        steps: int = 12
    ) -> Dict[str, Any]:
        """
        Calculates an OpenStreetMap-compatible route connecting two points.
        Returns:
            {
                "provider": "osrm" | "haversine_fallback",
                "distance_km": float,
                "eta_minutes": float,
                "coordinates": [[lat, lng], ...],
                "summary": str
            }
        """
        cache_key = f"{round(start_lat, 4)},{round(start_lng, 4)}->{round(dest_lat, 4)},{round(dest_lng, 4)}"
        if cache_key in _ROUTE_CACHE:
            cached = _ROUTE_CACHE[cache_key].copy()
            # Update ETA specific to vehicle type if requested
            cached["eta_minutes"] = self.calculate_eta(cached["distance_km"], resource_type, is_emergency)
            return cached

        # Attempt OSRM if configured
        if self.provider == "osrm":
            try:
                # OSRM public demo endpoint takes {lng},{lat};{lng},{lat}
                url = f"https://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson"
                headers = {"User-Agent": "CrisisCommand-EmergencySystem/1.0"}
                with httpx.Client(timeout=2.0) as client:
                    resp = client.get(url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("code") == "Ok" and data.get("routes"):
                            primary = data["routes"][0]
                            dist_meters = primary.get("distance", 0.0)
                            dist_km = round(dist_meters / 1000.0, 2)
                            duration_sec = primary.get("duration", 0.0)
                            # Emergency vehicles travel faster than typical car traffic with sirens
                            emergency_eta = round(max((duration_sec / 60.0) * 0.75 + 0.8, 1.5), 1)
                            
                            # GeoJSON coordinates are [lng, lat] -> convert to Leaflet [lat, lng]
                            raw_coords = primary.get("geometry", {}).get("coordinates", [])
                            leaflet_coords = [[round(pt[1], 6), round(pt[0], 6)] for pt in raw_coords]
                            
                            if len(leaflet_coords) >= 2:
                                route_data = {
                                    "provider": "osrm",
                                    "distance_km": dist_km,
                                    "eta_minutes": emergency_eta,
                                    "coordinates": leaflet_coords,
                                    "summary": f"OSRM Navigation Corridor ({dist_km} km, ~{emergency_eta}m)"
                                }
                                _ROUTE_CACHE[cache_key] = route_data
                                return route_data
            except Exception as e:
                logger.warning(f"OSRM query timed out or failed ({e}), falling back to deterministic routing.")

        # Deterministic Haversine Fallback
        dist_km = _haversine_distance(start_lat, start_lng, dest_lat, dest_lng)
        eta_min = self.calculate_eta(dist_km, resource_type, is_emergency)
        coords = _generate_synthetic_waypoints(start_lat, start_lng, dest_lat, dest_lng, steps=steps)

        route_data = {
            "provider": "haversine_fallback",
            "distance_km": dist_km,
            "eta_minutes": eta_min,
            "coordinates": coords,
            "summary": f"Direct Emergency Vector ({dist_km} km, ~{eta_min}m)"
        }
        _ROUTE_CACHE[cache_key] = route_data
        return route_data

# Global default routing service instance
routing_service = RoutingService()

# Module-level convenience functions matching user specifications
def calculate_distance(start_lat: float, start_lng: float, dest_lat: float, dest_lng: float) -> float:
    return routing_service.calculate_distance(start_lat, start_lng, dest_lat, dest_lng)

def calculate_eta(distance_km: float, resource_type: Optional[str] = None, is_emergency: bool = True) -> float:
    return routing_service.calculate_eta(distance_km, resource_type, is_emergency)

def calculate_route(
    start_lat: float,
    start_lng: float,
    dest_lat: float,
    dest_lng: float,
    resource_type: Optional[str] = None,
    is_emergency: bool = True
) -> Dict[str, Any]:
    return routing_service.calculate_route(start_lat, start_lng, dest_lat, dest_lng, resource_type, is_emergency)
