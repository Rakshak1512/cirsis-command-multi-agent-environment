import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import db

@pytest.fixture(autouse=True)
def ensure_db():
    db.seed_demo_data()

def test_demo_logins_all_roles():
    client = TestClient(app)
    cases = [
        ("citizen@crisiscommand.demo", "Citizen@123", "citizen", "citizen", "CITIZEN"),
        ("fireteam@crisiscommand.demo", "FireTeam@123", "fire_team", "fire_team", "FIRE_TEAM"),
        ("hospital@crisiscommand.demo", "Hospital@123", "hospital", "hospital", "HOSPITAL"),
        ("admin@crisiscommand.demo", "Admin@123", "admin", "admin", "ADMIN"),
    ]
    for email, pwd, role, sel_role, expected_role in cases:
        res = client.post("/auth/login", json={
            "email": email,
            "password": pwd,
            "role": role,
            "selected_role": sel_role
        })
        assert res.status_code == 200, f"Login failed for {email}: {res.text}"
        data = res.json()
        assert "access_token" in data
        assert data["user"]["role"] == expected_role

def test_wrong_password():
    client = TestClient(app)
    res = client.post("/auth/login", json={
        "email": "citizen@crisiscommand.demo",
        "password": "WrongPassword123",
        "role": "citizen",
        "selected_role": "citizen"
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password."

def test_nonexistent_account():
    client = TestClient(app)
    res = client.post("/auth/login", json={
        "email": "unknown_ghost@crisiscommand.demo",
        "password": "Password123!",
        "role": "citizen",
        "selected_role": "citizen"
    })
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password."

def test_wrong_role():
    client = TestClient(app)
    res = client.post("/auth/login", json={
        "email": "citizen@crisiscommand.demo",
        "password": "Citizen@123",
        "role": "hospital",
        "selected_role": "hospital"
    })
    assert res.status_code == 403
    assert "Role mismatch" in res.json()["detail"]

def test_idempotent_seeding():
    users_count_before = len(db.users)
    resources_count_before = len(db.resources)
    incidents_count_before = len(db.incidents)
    # Re-run seed_demo_data
    db.seed_demo_data()
    assert len(db.users) == users_count_before
    assert len(db.resources) == resources_count_before
    assert len(db.incidents) == incidents_count_before
