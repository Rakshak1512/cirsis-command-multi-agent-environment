import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import db
from app.models.schemas import UserRole

client = TestClient(app)

def test_public_commander_dispatcher_registration_blocked():
    # Attempting to register as COMMANDER publicly should be blocked (400)
    res_cmd = client.post("/auth/register", json={
        "full_name": "General Officer",
        "email": "rogue_commander@crisiscommand.demo",
        "password": "Password123!",
        "role": "COMMANDER"
    })
    assert res_cmd.status_code == 400
    assert "internal" in res_cmd.json()["detail"].lower()

    # Attempting to register as DISPATCHER publicly should be blocked (400)
    res_disp = client.post("/auth/register", json={
        "full_name": "Rogue Dispatcher",
        "email": "rogue_dispatcher@crisiscommand.demo",
        "password": "Password123!",
        "role": "DISPATCHER"
    })
    assert res_disp.status_code == 400
    assert "internal" in res_disp.json()["detail"].lower()

def test_admin_registration_code_protection():
    # Invalid admin registration code should fail (403)
    res_bad = client.post("/auth/register", json={
        "full_name": "Fake Admin",
        "email": "fake_admin@crisiscommand.demo",
        "password": "Password123!",
        "role": "ADMIN",
        "organization": "HQ",
        "admin_code": "WRONG_SECRET_CODE"
    })
    assert res_bad.status_code == 403
    assert "authorization code" in res_bad.json()["detail"].lower()

    # Valid admin registration code succeeds and triggers OTP
    res_good = client.post("/auth/register", json={
        "full_name": "Verified Super Admin",
        "email": "super_admin_test@crisiscommand.demo",
        "password": "Password123!",
        "role": "ADMIN",
        "organization": "National Emergency Management",
        "admin_code": "CRISIS-ADMIN-2026"
    })
    assert res_good.status_code == 200
    data = res_good.json()
    assert data["role"] == "ADMIN"
    assert "otp" in data

    # Verify OTP
    otp = data["otp"]
    res_verify = client.post("/auth/verify-otp", json={
        "email": "super_admin_test@crisiscommand.demo",
        "otp": otp
    })
    assert res_verify.status_code == 200
    assert res_verify.json()["user"]["role"] == "ADMIN"

def test_citizen_registration_and_otp():
    res = client.post("/auth/register", json={
        "full_name": "Jane Citizen",
        "email": "jane_citizen_test@crisiscommand.demo",
        "password": "CitizenPassword123!",
        "role": "CITIZEN"
    })
    assert res.status_code == 200
    otp = res.json()["otp"]

    res_verify = client.post("/auth/verify-otp", json={
        "email": "jane_citizen_test@crisiscommand.demo",
        "otp": otp
    })
    assert res_verify.status_code == 200
    assert res_verify.json()["user"]["role"] == "CITIZEN"

def test_fire_team_registration_and_resource_provisioning():
    res = client.post("/auth/register", json={
        "full_name": "Capt. James Miller",
        "team_leader_name": "Capt. James Miller",
        "station_name": "Station 44 High-Rise Rescue",
        "email": "fire_station_44@crisiscommand.demo",
        "password": "FireTeamPassword123!",
        "role": "FIRE_TEAM",
        "location_address": "88 Tower Road, Sector 4",
        "latitude": 12.9800,
        "longitude": 77.6100,
        "contact": "+1-800-FIRE-44",
        "emergency_capacity": 6,
        "equipment": ["Aerial Ladder", "High-Pressure Pumper", "Thermal Camera"]
    })
    assert res.status_code == 200
    otp = res.json()["otp"]

    res_verify = client.post("/auth/verify-otp", json={
        "email": "fire_station_44@crisiscommand.demo",
        "otp": otp
    })
    assert res_verify.status_code == 200
    assert res_verify.json()["user"]["role"] == "FIRE_TEAM"

    # Verify resource is dynamically provisioned in system resources
    matching_res = [
        r for r in db.resources.values()
        if "Station 44" in r.name or r.contact == "+1-800-FIRE-44"
    ]
    assert len(matching_res) > 0
    resource = matching_res[0]
    assert resource.type.value == "fire_team"
    assert resource.capacity == 6
    assert "Aerial Ladder" in resource.equipment

def test_hospital_registration_and_resource_provisioning():
    res = client.post("/auth/register", json={
        "full_name": "Dr. Sarah Chen",
        "hospital_name": "Memorial Trauma & Critical Care Center",
        "email": "memorial_trauma@crisiscommand.demo",
        "password": "HospitalPassword123!",
        "role": "HOSPITAL",
        "location_address": "120 Medical Parkway",
        "latitude": 12.9650,
        "longitude": 77.5850,
        "contact": "+1-800-TRAUMA-1",
        "emergency_capacity": 50,
        "available_beds": 35,
        "icu_beds": 8,
        "ambulance_capacity": 4,
        "specializations": ["Burn Unit", "Neuro-trauma", "Pediatric Emergency"]
    })
    assert res.status_code == 200
    otp = res.json()["otp"]

    res_verify = client.post("/auth/verify-otp", json={
        "email": "memorial_trauma@crisiscommand.demo",
        "otp": otp
    })
    assert res_verify.status_code == 200
    assert res_verify.json()["user"]["role"] == "HOSPITAL"

    # Verify hospital resource provisioned
    matching_res = [
        r for r in db.resources.values()
        if "Memorial Trauma" in r.name or r.contact == "+1-800-TRAUMA-1"
    ]
    assert len(matching_res) > 0
    hospital_res = matching_res[0]
    assert hospital_res.type.value == "hospital"
    assert hospital_res.capacity == 50
    assert hospital_res.available_units == 35
    assert "Burn Unit" in hospital_res.specialization

def test_demo_accounts_login():
    demo_accounts = [
        ("citizen@crisiscommand.demo", "Citizen@123", "CITIZEN"),
        ("fireteam@crisiscommand.demo", "FireTeam@123", "FIRE_TEAM"),
        ("hospital@crisiscommand.demo", "Hospital@123", "HOSPITAL"),
        ("admin@crisiscommand.demo", "Admin@123", "ADMIN"),
    ]
    for email, password, expected_role in demo_accounts:
        res = client.post("/auth/login", json={"email": email, "password": password, "role": expected_role.lower()})
        assert res.status_code == 200, f"Failed login for {email}: {res.text}"
        data = res.json()
        assert data["user"]["role"] == expected_role
        assert "access_token" in data

def test_section_26_auth_and_role_mismatch_matrix():
    # TEST 1: Select Citizen + citizen account + correct password -> SUCCESS
    res1 = client.post("/auth/login", json={
        "email": "citizen@crisiscommand.demo",
        "password": "Citizen@123",
        "role": "citizen"
    })
    assert res1.status_code == 200
    assert res1.json()["user"]["role"] == "CITIZEN"

    # TEST 2: Select Citizen + fire team account + correct password -> FAIL (role mismatch 403)
    res2 = client.post("/auth/login", json={
        "email": "fireteam@crisiscommand.demo",
        "password": "FireTeam@123",
        "role": "citizen"
    })
    assert res2.status_code == 403
    assert "role mismatch" in res2.json()["detail"].lower()
    assert "fire team" in res2.json()["detail"].lower()

    # TEST 3: Select Fire Team + fire team account + correct password -> SUCCESS
    res3 = client.post("/auth/login", json={
        "email": "fireteam@crisiscommand.demo",
        "password": "FireTeam@123",
        "role": "fire_team"
    })
    assert res3.status_code == 200
    assert res3.json()["user"]["role"] == "FIRE_TEAM"

    # TEST 4: Select Hospital + hospital account + correct password -> SUCCESS
    res4 = client.post("/auth/login", json={
        "email": "hospital@crisiscommand.demo",
        "password": "Hospital@123",
        "role": "hospital"
    })
    assert res4.status_code == 200
    assert res4.json()["user"]["role"] == "HOSPITAL"

    # TEST 5: Select Admin + admin account + correct password -> SUCCESS
    res5 = client.post("/auth/login", json={
        "email": "admin@crisiscommand.demo",
        "password": "Admin@123",
        "role": "admin"
    })
    assert res5.status_code == 200
    assert res5.json()["user"]["role"] == "ADMIN"

    # TEST 6: Select Admin + citizen account + correct password -> FAIL (role mismatch 403)
    res6 = client.post("/auth/login", json={
        "email": "citizen@crisiscommand.demo",
        "password": "Citizen@123",
        "role": "admin"
    })
    assert res6.status_code == 403
    assert "role mismatch" in res6.json()["detail"].lower()
    assert "citizen" in res6.json()["detail"].lower()

    # TEST 7: Wrong password -> FAIL (401)
    res7 = client.post("/auth/login", json={
        "email": "citizen@crisiscommand.demo",
        "password": "WrongPassword!999",
        "role": "citizen"
    })
    assert res7.status_code == 401
    assert "invalid email or password" in res7.json()["detail"].lower()

    # TEST 8: Non-existing account -> FAIL (401)
    res8 = client.post("/auth/login", json={
        "email": "nonexistent_user_999@crisiscommand.demo",
        "password": "AnyPassword123!",
        "role": "citizen"
    })
    assert res8.status_code == 401
    assert "invalid email or password" in res8.json()["detail"].lower()

def test_admin_list_and_update_users():
    # Test GET /auth/users
    res = client.get("/auth/users")
    assert res.status_code == 200
    data = res.json()
    assert "users" in data
    assert data["total"] >= 4
    
    # Test PATCH /auth/users/{email}/status
    test_email = "citizen@crisiscommand.demo"
    res_patch = client.patch(f"/auth/users/{test_email}/status", json={
        "status": "SUSPENDED"
    })
    assert res_patch.status_code == 200
    assert res_patch.json()["user"]["status"] == "SUSPENDED"

    # Restore to ACTIVE
    res_restore = client.patch(f"/auth/users/{test_email}/status", json={
        "status": "ACTIVE"
    })
    assert res_restore.status_code == 200
    assert res_restore.json()["user"]["status"] == "ACTIVE"
