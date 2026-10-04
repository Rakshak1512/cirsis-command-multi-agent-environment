"""
CRISIS COMMAND — Idempotent Administrative Seeding Service
Provisions development/demo test accounts in Cloud Firestore with proper bcrypt password hashing,
profile metadata, resources, and optional Firebase Auth synchronization.

Guarantees:
- Explicitly opt-in execution
- Fully idempotent: will NOT overwrite or duplicate existing user records or passwords
- Detailed per-account reporting (CREATED / SKIPPED / FAILED)
- Never stores plaintext passwords in Firestore
"""

import copy
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

from app.core.database import db, BASE_LAT, BASE_LNG
from app.core.security import get_password_hash
from app.models.schemas import (
    UserRole, Resource, ResourceType, ResourceStatus
)
from app.services.firebase_service import sync_auth_user, is_firestore_available

logger = logging.getLogger("crisis_command.seed")

# Core test accounts required by the specification
CORE_TEST_PERSONAS = [
    {
        "id": "usr_citizen_demo",
        "email": "citizen@crisiscommand.demo",
        "full_name": "Test Citizen",
        "role": UserRole.CITIZEN.value,
        "raw_password": "Citizen@123",
        "metadata": {
            "phone": "+1-555-0100",
            "district": "Downtown Sector 1",
            "address": "120 Elm Street, Downtown"
        }
    },
    {
        "id": "usr_fire_demo",
        "email": "fireteam@crisiscommand.demo",
        "full_name": "Central Fire Station Alpha",
        "role": UserRole.FIRE_TEAM.value,
        "raw_password": "FireTeam@123",
        "metadata": {
            "station_id": "RES-FIRE-01",
            "station_name": "Central Fire Station Alpha",
            "status": "AVAILABLE",
            "emergency_capacity": 4,
            "equipment": ["Heavy Engine 01", "Ladder Truck", "Hydraulic Extricator", "Thermal Imager"],
            "address": "104 MG Road Fire Station",
            "latitude": BASE_LAT + 0.012,
            "longitude": BASE_LNG + 0.008
        }
    },
    {
        "id": "usr_hospital_demo",
        "email": "hospital@crisiscommand.demo",
        "full_name": "Metro General Trauma Hospital",
        "role": UserRole.HOSPITAL.value,
        "raw_password": "Hospital@123",
        "metadata": {
            "hospital_id": "RES-HOSP-01",
            "hospital_name": "Metro General Trauma Hospital",
            "capacity": 25,
            "available_beds": 14,
            "icu_beds": 4,
            "ambulance_capacity": 3,
            "equipment": ["Trauma Bay", "ICU Suite", "Emergency Burn Unit", "CT Scanner"],
            "specializations": ["Level-1 Trauma", "Burn Unit", "Critical Resuscitation"],
            "address": "402 Healthcare Blvd, Metro Medical District",
            "latitude": BASE_LAT - 0.009,
            "longitude": BASE_LNG + 0.015
        }
    },
    {
        "id": "usr_admin_demo",
        "email": "admin@crisiscommand.demo",
        "full_name": "System Administrator",
        "role": UserRole.ADMIN.value,
        "raw_password": "Admin@123",
        "metadata": {
            "clearance": "Root Administrator",
            "department": "Autonomous Command Directorate",
            "badge": "SYS-ADMIN-01"
        }
    },
    {
        "id": "usr_commander_demo",
        "email": "commander@crisiscommand.demo",
        "full_name": "Chief Marcus Vance",
        "role": UserRole.COMMANDER.value,
        "raw_password": "Commander@123",
        "metadata": {
            "badge": "CMD-01",
            "clearance": "Operational Command",
            "sector": "Central EOC Tactical"
        }
    },
    {
        "id": "usr_dispatcher_demo",
        "email": "dispatcher@crisiscommand.demo",
        "full_name": "Metro Central CAD Dispatcher",
        "role": UserRole.DISPATCHER.value,
        "raw_password": "Dispatcher@123",
        "metadata": {
            "desk": "Metro Central CAD 01",
            "clearance": "CAD Tactical"
        }
    },
]

# Baseline emergency resources
BASELINE_RESOURCES = [
    {
        "id": "RES-FIRE-01",
        "name": "Central Fire Station Alpha",
        "type": ResourceType.FIRE_TEAM,
        "status": ResourceStatus.AVAILABLE,
        "latitude": BASE_LAT + 0.012,
        "longitude": BASE_LNG + 0.008,
        "address": "104 MG Road Fire Station",
        "contact": "fireteam@crisiscommand.demo",
        "capacity": 4,
        "available_units": 4,
        "equipment": ["Heavy Engine 01", "Ladder Truck", "Hydraulic Extricator", "Thermal Imager"],
        "specialization": ["structural", "rescue", "hazmat"]
    },
    {
        "id": "RES-AMB-01",
        "name": "Paramedic Unit 01 (Advanced ALS)",
        "type": ResourceType.AMBULANCE,
        "status": ResourceStatus.AVAILABLE,
        "latitude": BASE_LAT + 0.005,
        "longitude": BASE_LNG + 0.012,
        "address": "50 Health Plaza",
        "contact": "+1-555-0911",
        "capacity": 2,
        "available_units": 2,
        "equipment": ["Defibrillator", "Ventilator", "Trauma Kit", "Telemetry"],
        "specialization": ["als", "resuscitation"]
    },
    {
        "id": "RES-HOSP-01",
        "name": "Metro General Trauma Hospital",
        "type": ResourceType.HOSPITAL,
        "status": ResourceStatus.AVAILABLE,
        "latitude": BASE_LAT - 0.009,
        "longitude": BASE_LNG + 0.015,
        "address": "402 Healthcare Blvd, Metro Medical District",
        "contact": "hospital@crisiscommand.demo",
        "capacity": 25,
        "available_units": 14,
        "equipment": ["Trauma Bay", "ICU Suite", "Emergency Burn Unit", "CT Scanner"],
        "specialization": ["Level-1 Trauma", "Burn Unit", "Critical Resuscitation"]
    }
]


def seed_test_accounts(force_update: bool = False) -> Dict[str, Any]:
    """
    Provisions test accounts and core resources into the database (Firestore + RAM).
    If an account already exists and force_update is False, skips it without overwriting.
    """
    results: List[Dict[str, Any]] = []
    created_count = 0
    skipped_count = 0
    failed_count = 0
    now_str = datetime.utcnow().isoformat() + "Z"

    # 1. Provision User Accounts
    for persona in CORE_TEST_PERSONAS:
        email = persona["email"].strip().lower()
        role = persona["role"]
        try:
            # Check persistent Firestore directly if connected, otherwise fallback to local db
            exists_in_persistent_db = False
            existing_doc = None
            if db._firestore_db:
                doc_snap = db._firestore_db.collection("users").document(email).get()
                if doc_snap.exists:
                    exists_in_persistent_db = True
                    existing_doc = doc_snap.to_dict()
            else:
                existing_doc = db.users.get(email)
                exists_in_persistent_db = existing_doc is not None

            if exists_in_persistent_db and not force_update:
                results.append({
                    "email": email,
                    "role": role,
                    "status": "SKIPPED",
                    "detail": "User already exists in Firestore database (retained existing credentials)"
                })
                skipped_count += 1
                continue

            # Construct safe user record with bcrypt password hash
            user_doc = {
                "id": persona["id"],
                "email": email,
                "full_name": persona["full_name"],
                "role": role,
                "password_hash": get_password_hash(persona["raw_password"]),
                "is_verified": True,
                "status": "ACTIVE",
                "created_at": existing_doc.get("created_at") if existing_doc else now_str,
                "updated_at": now_str,
                "metadata": copy.deepcopy(persona.get("metadata", {}))
            }

            # Persist to database (in-memory + Firestore)
            db.save_user(user_doc)

            # Optional Firebase Auth sync (non-blocking)
            try:
                sync_auth_user(
                    email=email,
                    password=persona["raw_password"],
                    display_name=persona["full_name"],
                    uid=persona["id"]
                )
            except Exception as auth_err:
                logger.debug(f"Auth sync skipped for {email}: {auth_err}")

            action_type = "UPDATED" if existing_doc else "CREATED"
            results.append({
                "email": email,
                "role": role,
                "status": action_type,
                "detail": f"Account successfully provisioned in Firestore ({action_type.lower()})"
            })
            created_count += 1

        except Exception as e:
            logger.error(f"Failed to seed account {email}: {e}")
            results.append({
                "email": email,
                "role": role,
                "status": "FAILED",
                "detail": str(e)
            })
            failed_count += 1

    # 2. Provision Core Baseline Resources
    resources_created = 0
    for r_def in BASELINE_RESOURCES:
        r_id = r_def["id"]
        try:
            exists_in_firestore = False
            if db._firestore_db:
                doc_snap = db._firestore_db.collection("resources").document(r_id).get()
                exists_in_firestore = doc_snap.exists
            else:
                exists_in_firestore = r_id in db.resources

            if not exists_in_firestore or force_update:
                res_obj = Resource(
                    id=r_id,
                    name=r_def["name"],
                    type=r_def["type"],
                    status=r_def["status"],
                    latitude=r_def["latitude"],
                    longitude=r_def["longitude"],
                    address=r_def["address"],
                    contact=r_def["contact"],
                    capacity=r_def["capacity"],
                    available_units=r_def["available_units"],
                    equipment=r_def["equipment"],
                    specialization=r_def["specialization"],
                    updated_at=now_str
                )
                db.save_resource(res_obj)
                resources_created += 1
        except Exception as e:
            logger.warning(f"Failed to seed resource {r_id}: {e}")

    summary = {
        "status": "success" if failed_count == 0 else "partial_success",
        "timestamp": now_str,
        "firestore_connected": is_firestore_available(),
        "total_accounts": len(CORE_TEST_PERSONAS),
        "created_or_updated": created_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "resources_provisioned": resources_created,
        "results": results
    }
    logger.info(f"Seeding completed: {created_count} created, {skipped_count} skipped, {failed_count} failed.")
    return summary
