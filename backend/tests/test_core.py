import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.decision_engine.optimizer import calculate_haversine_distance, calculate_eta_minutes
from app.models.schemas import ResourceType

client = TestClient(app)

def test_health_and_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert "Crisis Command" in data["system"]

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"

def test_haversine_and_eta():
    # Distance between ~12.9716, 77.5946 and ~12.9816, 77.6046 is ~1.5 km
    dist = calculate_haversine_distance(12.9716, 77.5946, 12.9816, 77.6046)
    assert 1.0 <= dist <= 2.5
    eta = calculate_eta_minutes(dist, ResourceType.FIRE_TEAM)
    assert 1.5 <= eta <= 10.0

def test_login_demo_commander():
    response = client.post("/auth/login", json={
        "email": "commander@crisiscommand.org",
        "password": "Password123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "COMMANDER"

def test_incident_creation_and_auto_plan_v1():
    response = client.post("/incidents", json={
        "incident_type": "fire",
        "description": "Explosion and active structural fire on 2nd floor, 5 victims evacuating.",
        "people_affected": 5,
        "latitude": 12.9750,
        "longitude": 77.5980,
        "address": "42 Tech Boulevard Central Plaza"
    })
    assert response.status_code == 200
    incident = response.json()
    assert incident["status"] == "ALLOCATED"
    assert incident["current_plan_version"] == "PLAN V1"
    assert incident["severity"] in ["HIGH", "CRITICAL"]
    assert len(incident["plans"]) >= 1

def test_dynamic_replanning_to_plan_v2():
    response = client.post("/replanning/trigger", json={
        "incident_id": "INC-001",
        "reason": "Fire spread to adjoining fuel tank",
        "escalate_severity": "CRITICAL"
    })
    assert response.status_code == 200
    plan = response.json()
    assert plan["version"] == "PLAN V2"
    assert "Fire spread" in plan["change_reason"]
    assert len(plan["assignments"]) >= 1

def test_whatsapp_share_alert():
    response = client.post("/share/whatsapp", json={
        "incident_id": "INC-001"
    })
    assert response.status_code == 200
    data = response.json()
    assert "whatsapp_url" in data
    assert "CRISIS COMMAND ALERT" in data["formatted_text"]

def test_commander_override():
    response = client.post("/commander/override", json={
        "incident_id": "INC-001",
        "action_type": "CHANGE_SEVERITY",
        "new_severity": "CRITICAL",
        "reason": "Chief Commander direct visual confirmation of structural beam failure"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

def test_analytics_metrics():
    response = client.get("/analytics")
    assert response.status_code == 200
    data = response.json()
    assert data["total_incidents"] >= 10
    assert "resource_utilization" in data
    assert "fire_teams" in data["resource_utilization"]
