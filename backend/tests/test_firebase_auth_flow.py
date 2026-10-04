import os
import sys

# Ensure backend root is on sys.path
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(TEST_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest
from fastapi.testclient import TestClient
from dotenv import load_dotenv

# Ensure .env is loaded
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

from app.main import app
from app.core.database import db
from app.core.config import settings
from app.services.firebase_service import get_firestore_client, is_firestore_available

client = TestClient(app)

def test_firebase_firestore_connectivity():
    """Verify that Firebase Admin SDK connects to Firestore."""
    fs = get_firestore_client()
    assert fs is not None, "Firestore client failed to initialize"
    assert is_firestore_available() is True, "Firestore should be reported as available"

def test_seed_idempotency_and_firestore_persistence():
    """Verify that seeding provisions users and resources to Firestore without duplicates."""
    from app.services.seed_service import seed_test_accounts
    summary = seed_test_accounts(force_update=False)
    assert summary["status"] in ("success", "partial_success")
    assert summary["firestore_connected"] is True
    assert summary["total_accounts"] >= 4

    # Run seed a second time: all should be SKIPPED
    summary2 = seed_test_accounts(force_update=False)
    assert summary2["skipped"] == summary["total_accounts"]
    assert summary2["created_or_updated"] == 0

    # Verify Firestore document directly
    fs = get_firestore_client()
    doc = fs.collection("users").document("citizen@crisiscommand.demo").get()
    assert doc.exists is True
    data = doc.to_dict()
    assert data["role"] == "CITIZEN"
    assert data["status"] == "ACTIVE"
    assert data["is_verified"] is True
    assert "password_hash" in data
    assert "Citizen@123" not in str(data)  # Never plaintext password in Firestore

def test_four_roles_login_success():
    """Verify all four role tabs authenticate successfully with their correct role."""
    roles_to_test = [
        ("citizen@crisiscommand.demo", "Citizen@123", "citizen", "CITIZEN"),
        ("fireteam@crisiscommand.demo", "FireTeam@123", "fire_team", "FIRE_TEAM"),
        ("hospital@crisiscommand.demo", "Hospital@123", "hospital", "HOSPITAL"),
        ("admin@crisiscommand.demo", "Admin@123", "admin", "ADMIN"),
    ]
    for email, password, tab_role, expected_role in roles_to_test:
        resp = client.post("/auth/login", json={
            "email": email,
            "password": password,
            "role": tab_role,
            "selected_role": tab_role
        })
        assert resp.status_code == 200, f"Login failed for {email} on {tab_role}: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["role"] == expected_role
        assert data["user"]["is_verified"] is True

def test_role_mismatch_enforcement():
    """Verify that selecting wrong role tab raises 403 Role Mismatch."""
    # Citizen trying to log in under Fire Team tab
    resp = client.post("/auth/login", json={
        "email": "citizen@crisiscommand.demo",
        "password": "Citizen@123",
        "role": "fire_team",
        "selected_role": "fire_team"
    })
    assert resp.status_code == 403
    assert "Role mismatch" in resp.json()["detail"]

    # Hospital trying to log in under Citizen tab
    resp = client.post("/auth/login", json={
        "email": "hospital@crisiscommand.demo",
        "password": "Hospital@123",
        "role": "citizen",
        "selected_role": "citizen"
    })
    assert resp.status_code == 403
    assert "Role mismatch" in resp.json()["detail"]

def test_invalid_password():
    """Verify wrong password returns 401."""
    resp = client.post("/auth/login", json={
        "email": "citizen@crisiscommand.demo",
        "password": "WrongPassword999!",
        "role": "citizen",
        "selected_role": "citizen"
    })
    assert resp.status_code == 401

def test_registration_and_firestore_write():
    """Verify registration creates pending record, OTP activates it, and user is saved to Firestore."""
    test_email = "autotest_citizen_2026@crisiscommand.demo"
    # Clean up if existing
    fs = get_firestore_client()
    fs.collection("users").document(test_email).delete()
    db.users.pop(test_email, None)

    reg_resp = client.post("/auth/register", json={
        "email": test_email,
        "password": "StrongPassword@123",
        "full_name": "Automated Test Citizen",
        "role": "CITIZEN",
        "location_address": "Test Avenue 10"
    })
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert reg_data["status"] == "success"

    # Get OTP from response or cache
    otp = reg_data.get("otp")
    if not otp:
        from app.core.security import generate_otp
        otp = generate_otp(test_email)

    # Verify OTP
    verify_resp = client.post("/auth/verify-otp", json={
        "email": test_email,
        "otp": otp
    })
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert "access_token" in v_data
    assert v_data["user"]["email"] == test_email
    assert v_data["user"]["role"] == "CITIZEN"

    # Verify document in Firestore
    doc = fs.collection("users").document(test_email).get()
    assert doc.exists is True
    doc_dict = doc.to_dict()
    assert doc_dict["email"] == test_email
    assert doc_dict["status"] == "ACTIVE"
    assert doc_dict["is_verified"] is True
    assert "StrongPassword@123" not in str(doc_dict)  # Password must not be plaintext

    # Test duplicate registration (must return 400)
    dup_resp = client.post("/auth/register", json={
        "email": test_email,
        "password": "StrongPassword@123",
        "full_name": "Automated Test Citizen Duplicate",
        "role": "CITIZEN"
    })
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"].lower()

    # Clean up test user
    fs.collection("users").document(test_email).delete()
    db.users.pop(test_email, None)

def test_protected_seed_endpoint():
    """Verify POST /auth/seed requires valid secret key."""
    # Without header -> 403
    resp_unauth = client.post("/auth/seed")
    assert resp_unauth.status_code == 403

    # With invalid key -> 403
    resp_bad = client.post("/auth/seed", headers={"X-Admin-Seed-Key": "WRONG_SECRET"})
    assert resp_bad.status_code == 403

    # With valid key -> 200 OK
    secret = os.getenv("ADMIN_SEED_SECRET", getattr(settings, "ADMIN_SEED_SECRET", "CRISIS-COMMAND-ROOT-SEED-2026"))
    resp_ok = client.post("/auth/seed", headers={"X-Admin-Seed-Key": secret})
    assert resp_ok.status_code == 200
    data = resp_ok.json()
    assert data["status"] in ("success", "partial_success")
    assert "results" in data

def test_persistence_across_restarts():
    """Simulate backend restart by wiping memory and calling sync_from_firestore."""
    db.users.clear()
    assert len(db.users) == 0

    db.sync_from_firestore()
    assert len(db.users) >= 4
    assert "citizen@crisiscommand.demo" in db.users
    assert "fireteam@crisiscommand.demo" in db.users
    assert "hospital@crisiscommand.demo" in db.users
    assert "admin@crisiscommand.demo" in db.users
