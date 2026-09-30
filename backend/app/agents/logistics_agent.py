from typing import List, Dict, Any
from app.services.routing_service import routing_service

class LogisticsRouteAgent:
    """Calculates route vectors, waypoint coordinates, and ETA trajectories using OpenStreetMap / OSRM."""

    def compute_logistics(
        self,
        resource_id: str,
        resource_name: str,
        start_lat: float,
        start_lng: float,
        dest_lat: float,
        dest_lng: float,
        distance_km: float,
        eta_minutes: float
    ) -> Dict[str, Any]:
        route_res = routing_service.calculate_route(start_lat, start_lng, dest_lat, dest_lng)
        route_coords = route_res.get("coordinates", [])
        route_summary = route_res.get("summary") or f"Fastest Emergency Corridor (ETA: {eta_minutes}m, {distance_km}km)"

        return {
            "resource_id": resource_id,
            "resource_name": resource_name,
            "distance_km": distance_km,
            "eta_minutes": eta_minutes,
            "route_summary": route_summary,
            "route_coordinates": route_coords
        }
