import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import db

client = TestClient(app)

def test_reverse_geocoding_validation_invalid_bounds():
    # Test invalid latitude > 90
    res = client.get("/geo/reverse?lat=95.0&lng=77.5")
    assert res.status_code == 422

    # Test invalid latitude < -90
    res = client.get("/geo/reverse?lat=-95.0&lng=77.5")
    assert res.status_code == 422

    # Test invalid longitude > 180
    res = client.get("/geo/reverse?lat=12.9&lng=185.0")
    assert res.status_code == 422

    # Test invalid longitude < -180
    res = client.get("/geo/reverse?lat=12.9&lng=-185.0")
    assert res.status_code == 422

def test_incident_coordinate_and_accuracy_validation():
    # Test valid incident creation with coordinates & accuracy
    valid_payload = {
        "incident_type": "fire",
        "description": "Validation test emergency fire incident",
        "people_affected": 2,
        "latitude": 12.9716,
        "longitude": 77.5946,
        "accuracy": 14.5,
        "address": "Indiranagar, Bengaluru, Karnataka"
    }
    res = client.post("/incidents", json=valid_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["latitude"] == 12.9716
    assert data["longitude"] == 77.5946
    assert data["accuracy"] == 14.5

    # Test invalid latitude out of bounds
    invalid_lat = dict(valid_payload, latitude=120.0)
    res_lat = client.post("/incidents", json=invalid_lat)
    assert res_lat.status_code == 422

    # Test invalid longitude out of bounds
    invalid_lng = dict(valid_payload, longitude=-195.0)
    res_lng = client.post("/incidents", json=invalid_lng)
    assert res_lng.status_code == 422

    # Test invalid negative accuracy
    invalid_acc = dict(valid_payload, accuracy=-5.0)
    res_acc = client.post("/incidents", json=invalid_acc)
    assert res_acc.status_code == 422
