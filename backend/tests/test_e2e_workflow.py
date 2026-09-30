import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import db
from app.models.schemas import ResourceStatus

client = TestClient(app)

def test_e2e_part39_complete_incident_lifecycle():
    """
    Test 1, 2, 3, 4:
    Citizen reports FIRE -> AI assessment -> Deterministic allocation ->
    Targeted notifications -> Fire Team accepts -> Live GPS telemetry stream ->
    Hospital accepts.
    """
    # 1. Citizen reports FIRE with valid GPS coordinates and accuracy
    report_payload = {
        "incident_type": "fire",
        "description": "Large building fire, heavy black smoke pouring out, multiple people trapped inside 2nd floor.",
        "people_affected": 4,
        "latitude": 12.9750,
        "longitude": 77.5900,
        "accuracy": 10.5,
        "address": "MG Road Commercial Complex, Bengaluru",
        "source_type": "citizen_report",
        "source_confidence": 0.98,
        "reported_by_id": "usr_citizen_tester"
    }

    resp = client.post("/incidents", json=report_payload)
    assert resp.status_code == 200, resp.text
    incident = resp.json()
    incident_id = incident["id"]

    assert incident["severity"] in ["CRITICAL", "HIGH"]
    assert incident["status"] == "ALLOCATED"
    assert incident["current_plan_id"] is not None
    assert len(incident["plans"]) > 0

    plan = incident["plans"][-1]
    assignments = plan["assignments"]
    assert len(assignments) >= 1

    # Find assigned fire team and hospital
    fire_asg = next((a for a in assignments if a["resource_type"] == "fire_team"), None)
    hosp_asg = next((a for a in assignments if a["resource_type"] == "hospital"), None)

    assert fire_asg is not None, "Fire team must be allocated for a large building fire"

    # Targeted notifications check:
    notifs = client.get(f"/notifications?incident_id={incident_id}").json()
    assert len(notifs) >= 1
    # Check that fire team was targeted
    fire_notif = next((n for n in notifs if n.get("resource_id") == fire_asg["resource_id"]), None)
    assert fire_notif is not None, "Assigned fire team must receive targeted notification"

    # TEST 2: Fire Team Accepts Assignment
    accept_resp = client.post(f"/assignments/{fire_asg['id']}/accept", json={
        "action": "ACCEPT",
        "actor_id": fire_asg["resource_id"],
        "actor_role": "FIRE_TEAM"
    })
    assert accept_resp.status_code == 200, accept_resp.text
    updated_fire_asg = accept_resp.json()
    assert updated_fire_asg["status"] == "ACCEPTED"

    # Verify citizen received acceptance notification
    updated_notifs = client.get(f"/notifications?incident_id={incident_id}&user_id=usr_citizen_tester").json()
    accept_citizen_notif = next((n for n in updated_notifs if "accepted" in n["message"].lower()), None)
    assert accept_citizen_notif is not None, "Citizen must receive notification when fire team accepts"

    # TEST 3: Fire Team Streams Live Location Telemetry
    telemetry_payload = {
        "resource_id": fire_asg["resource_id"],
        "latitude": 12.9730,
        "longitude": 77.5910,
        "accuracy": 8.0,
        "heading": 45.0,
        "speed": 12.5,
        "timestamp": "2026-09-30T15:00:00Z"
    }
    loc_resp = client.post(f"/resources/{fire_asg['resource_id']}/location", json=telemetry_payload)
    assert loc_resp.status_code == 200, loc_resp.text
    loc_data = loc_resp.json()
    assert loc_data["is_live_location"] is True
    assert loc_data["latitude"] == 12.9730
    assert loc_data["accuracy"] == 8.0

    # Verify updated assignment distance & ETA were deterministically recalculated
    asg_detail = client.get(f"/assignments?incident_id={incident_id}").json()
    current_fire_asg = next((a for a in asg_detail if a["id"] == fire_asg["id"]), None)
    assert current_fire_asg is not None
    assert current_fire_asg["distance_km"] > 0
    assert current_fire_asg["eta_minutes"] >= 1

    # TEST 4: Hospital Accepts (if assigned)
    if hosp_asg:
        initial_hosp = db.resources[hosp_asg["resource_id"]]
        initial_avail = initial_hosp.available_units

        hosp_accept_resp = client.post(f"/assignments/{hosp_asg['id']}/accept", json={
            "action": "ACCEPT",
            "actor_id": hosp_asg["resource_id"],
            "actor_role": "HOSPITAL"
        })
        assert hosp_accept_resp.status_code == 200
        # Capacity must be decremented/reserved
        updated_hosp = db.resources[hosp_asg["resource_id"]]
        assert updated_hosp.available_units == max(0, initial_avail - 1)


def test_e2e_part39_test5_resource_rejection_triggers_replanning():
    """
    TEST 5: Resource becomes unavailable or rejects assignment ->
    Dynamic Replanning triggered -> alternative candidate allocated -> Plan V2.
    """
    report_payload = {
        "incident_type": "fire",
        "description": "Warehouse fire outbreak requiring engine dispatch",
        "people_affected": 2,
        "latitude": 12.9600,
        "longitude": 77.5800,
        "source_type": "citizen_report"
    }

    resp = client.post("/incidents", json=report_payload)
    assert resp.status_code == 200
    incident = resp.json()
    plan_v1 = incident["plans"][-1]
    fire_asg = next((a for a in plan_v1["assignments"] if a["resource_type"] == "fire_team"), None)
    assert fire_asg is not None

    # Fire Team rejects assignment
    reject_resp = client.post(f"/assignments/{fire_asg['id']}/reject", json={
        "action": "REJECT",
        "actor_id": fire_asg["resource_id"],
        "actor_role": "FIRE_TEAM",
        "reason": "Vehicle mechanical failure en route"
    })
    assert reject_resp.status_code == 200
    reject_data = reject_resp.json()
    assert reject_data["status"] == "REJECTED"

    # Verify incident now has Plan V2 or updated plan
    updated_inc = client.get(f"/incidents/{incident['id']}").json()
    assert len(updated_inc["plans"]) >= 2 or updated_inc["current_plan_version"] in ["PLAN V2", "PLAN V1-UPDATED"]


def test_e2e_part39_test6_hospital_capacity_exhaustion():
    """
    TEST 6: Hospital capacity is zero -> excluded from eligible candidates.
    No AI-invented capacity allowed.
    """
    # Temporarily set all hospitals to 0 available units
    saved_capacities = {}
    for r_id, r in db.resources.items():
        if r.type.value == "hospital":
            saved_capacities[r_id] = r.available_units
            r.available_units = 0

    try:
        report_payload = {
            "incident_type": "road_accident",
            "description": "Major pileup on highway, several severe trauma injuries",
            "people_affected": 5,
            "latitude": 12.9800,
            "longitude": 77.6000
        }
        resp = client.post("/incidents", json=report_payload)
        assert resp.status_code == 200
        inc = resp.json()
        plan = inc["plans"][-1]
        # Since all hospitals have 0 available units, no hospital can be assigned
        hosp_asg = [a for a in plan["assignments"] if a["resource_type"] == "hospital"]
        assert len(hosp_asg) == 0, "No hospital with 0 capacity may be assigned"
    finally:
        # Restore capacities
        for r_id, cap in saved_capacities.items():
            db.resources[r_id].available_units = cap


def test_e2e_part39_test8_invalid_or_missing_coordinates():
    """
    TEST 8: Location missing or out of valid latitude/longitude bounds -> 422 error.
    No fake Malleswaram fallback coordinates allowed.
    """
    invalid_payload = {
        "incident_type": "fire",
        "description": "Fire test",
        "people_affected": 1,
        "latitude": 999.0, # Invalid latitude
        "longitude": 77.5946
    }
    resp = client.post("/incidents", json=invalid_payload)
    assert resp.status_code == 422
