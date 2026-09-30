import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.routing_service import routing_service, calculate_distance, calculate_eta, calculate_route
from app.services.geocoding_service import geocoding_service
from app.core.config import settings

client = TestClient(app)

def test_osm_env_and_config():
    """Verify settings configure OpenStreetMap and do not have GOOGLE_MAPS_API_KEY."""
    assert settings.MAP_PROVIDER == "openstreetmap"
    assert settings.MAP_TILE_PROVIDER == "openstreetmap"
    assert settings.GEOCODING_PROVIDER == "nominatim"
    assert settings.ROUTING_PROVIDER == "osrm"
    assert not hasattr(settings, "GOOGLE_MAPS_API_KEY")

def test_routing_service_deterministic():
    """Verify calculate_distance and calculate_eta return accurate, deterministic figures."""
    # Distance between Bangalore downtown points (~5 km)
    dist = calculate_distance(12.9716, 77.5946, 12.9352, 77.6245)
    assert 4.0 <= dist <= 6.5
    
    # ETA calculation based on emergency speed profiles
    eta_fire = calculate_eta(dist, "fire_team")
    assert eta_fire > 1.5
    
    eta_amb = calculate_eta(dist, "ambulance")
    assert eta_amb > 1.5

def test_routing_service_calculate_route():
    """Verify calculate_route returns valid waypoint coordinates and metadata."""
    route = calculate_route(12.9716, 77.5946, 12.9352, 77.6245, "fire_team")
    assert "coordinates" in route
    assert len(route["coordinates"]) >= 2
    assert "distance_km" in route
    assert "eta_minutes" in route
    # Every coordinate must be [lat, lng]
    for pt in route["coordinates"][:5]:
        assert len(pt) == 2
        assert 12.0 <= pt[0] <= 13.5
        assert 77.0 <= pt[1] <= 78.0

def test_geocoding_service():
    """Verify OpenStreetMap Nominatim geocoding & reverse geocoding with caching."""
    geo = geocoding_service.geocode("Koramangala")
    assert geo is not None
    assert "latitude" in geo
    assert "longitude" in geo
    
    rev = geocoding_service.reverse_geocode(12.9716, 77.5946)
    assert rev is not None
    assert len(rev) > 0

def test_geo_endpoints():
    """Test FastAPI /geo/geocode, /geo/reverse, and /geo/route endpoints."""
    # Geocode
    res1 = client.get("/geo/geocode?q=MG%20Road")
    assert res1.status_code == 200
    assert "data" in res1.json()

    # Reverse
    res2 = client.get("/geo/reverse?lat=12.9716&lng=77.5946")
    assert res2.status_code == 200
    assert "address" in res2.json()

    # Route
    res3 = client.post("/geo/route", json={
        "start_lat": 12.9716,
        "start_lng": 77.5946,
        "dest_lat": 12.9352,
        "dest_lng": 77.6245,
        "resource_type": "ambulance",
        "is_emergency": True
    })
    assert res3.status_code == 200
    route_json = res3.json()["route"]
    assert len(route_json["coordinates"]) >= 2

def test_share_uses_openstreetmap_urls():
    """Verify sharing endpoints generate OpenStreetMap URLs instead of Google Maps."""
    res = client.get("/share/incident/INC-001")
    assert res.status_code == 200
    data = res.json()
    assert "openstreetmap.org" in data["map_url"]
    assert "google.com/maps" not in data["map_url"]
