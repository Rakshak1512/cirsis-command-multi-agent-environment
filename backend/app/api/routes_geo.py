from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from app.services.geocoding_service import geocoding_service
from app.services.routing_service import routing_service

router = APIRouter(prefix="/geo", tags=["Geocoding & Routing"])

class RouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    dest_lat: float
    dest_lng: float
    resource_type: Optional[str] = None
    is_emergency: bool = True

@router.get("/geocode")
def geocode_address(q: str = Query(..., min_length=2, description="Address or locality query")):
    """Geocodes an address query using OpenStreetMap Nominatim with caching."""
    result = geocoding_service.geocode(q)
    if not result:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"status": "success", "data": result}

@router.get("/reverse")
def reverse_geocode(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180")
):
    """Reverse geocodes coordinates to clean readable address string using OpenStreetMap Nominatim."""
    res = geocoding_service.reverse_geocode(lat, lng)
    if isinstance(res, dict):
        addr = res.get("readable_address") or res.get("display_name")
        return {
            "status": "success",
            "address": addr,
            "readable_address": addr,
            "display_name": res.get("display_name"),
            "city": res.get("city"),
            "state": res.get("state"),
            "country": res.get("country"),
            "latitude": lat,
            "longitude": lng
        }
    return {"status": "success", "address": res, "readable_address": res, "latitude": lat, "longitude": lng}

@router.post("/route")
def calculate_route_endpoint(req: RouteRequest):
    """Calculates route vectors using OpenStreetMap-compatible routing (OSRM)."""
    route = routing_service.calculate_route(
        start_lat=req.start_lat,
        start_lng=req.start_lng,
        dest_lat=req.dest_lat,
        dest_lng=req.dest_lng,
        resource_type=req.resource_type,
        is_emergency=req.is_emergency
    )
    return {"status": "success", "route": route}
