import time
import uuid
import copy
from typing import Dict, List, Optional, Any
from app.models.schemas import (
    UserRole, IncidentType, IncidentSeverity, IncidentUrgency,
    IncidentStatus, ResourceType, ResourceStatus, Resource,
    Incident, ResponsePlan, Assignment, Notification, AuditLog
)
from app.core.security import get_password_hash

# Coordinate baseline for metropolitan emergency grid (e.g. Downtown Metro Grid)
BASE_LAT = 12.9716
BASE_LNG = 77.5946

class Database:
    def __init__(self):
        self.users: Dict[str, Dict[str, Any]] = {}
        self.resources: Dict[str, Resource] = {}
        self.incidents: Dict[str, Incident] = {}
        self.response_plans: Dict[str, ResponsePlan] = {}
        self.assignments: Dict[str, Assignment] = {}
        self.notifications: List[Notification] = []
        self.audit_logs: List[AuditLog] = []
        self.seed_demo_data()

    def reset(self):
        self.users.clear()
        self.resources.clear()
        self.incidents.clear()
        self.response_plans.clear()
        self.assignments.clear()
        self.notifications.clear()
        self.audit_logs.clear()
        self.seed_demo_data()

    def seed_demo_data(self):
        from app.core.config import settings
        if not settings.DEMO_MODE:
            return

        # 1. Seed Mandatory Development/Demo Test Accounts
        demo_accounts = [
            {
                "id": "usr_citizen_demo",
                "email": "citizen@crisiscommand.demo",
                "full_name": "Test Citizen",
                "role": UserRole.CITIZEN.value,
                "password_hash": get_password_hash("Citizen@123"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"phone": "+1-555-0100", "district": "Downtown Sector 1"}
            },
            {
                "id": "usr_fire_demo",
                "email": "fireteam@crisiscommand.demo",
                "full_name": "Test Fire Team",
                "role": UserRole.FIRE_TEAM.value,
                "password_hash": get_password_hash("FireTeam@123"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"station_id": "RES-FIRE-01", "station_name": "Demo Fire Station", "status": "AVAILABLE"}
            },
            {
                "id": "usr_hospital_demo",
                "email": "hospital@crisiscommand.demo",
                "full_name": "Test Hospital",
                "role": UserRole.HOSPITAL.value,
                "password_hash": get_password_hash("Hospital@123"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"hospital_id": "RES-HOSP-01", "hospital_name": "Demo Emergency Hospital", "capacity": 20, "available_beds": 10}
            },
            {
                "id": "usr_commander_demo",
                "email": "commander@crisiscommand.demo",
                "full_name": "Test Commander",
                "role": UserRole.COMMANDER.value,
                "password_hash": get_password_hash("Commander@123"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"badge": "CMD-DEMO-01", "clearance": "Operational Command"}
            },
            {
                "id": "usr_dispatcher_demo",
                "email": "dispatcher@crisiscommand.demo",
                "full_name": "Test Dispatcher",
                "role": UserRole.DISPATCHER.value,
                "password_hash": get_password_hash("Dispatcher@123"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"desk": "Metro Central CAD 01"}
            },
            {
                "id": "usr_admin_demo",
                "email": "admin@crisiscommand.demo",
                "full_name": "Test Administrator",
                "role": UserRole.ADMIN.value,
                "password_hash": get_password_hash("Admin@123"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"clearance": "Root Administrator"}
            },
            # Also keep standard domain aliases for instant convenience
            {
                "id": "usr_commander_1",
                "email": "commander@crisiscommand.org",
                "full_name": "Chief Commander Marcus Vance",
                "role": UserRole.COMMANDER.value,
                "password_hash": get_password_hash("Password123!"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"badge": "CMD-01", "sector": "HQ Command"}
            },
            {
                "id": "usr_fire_1",
                "email": "fire@crisiscommand.org",
                "full_name": "Captain Elena Rostova",
                "role": UserRole.FIRE_TEAM.value,
                "password_hash": get_password_hash("Password123!"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"station_id": "RES-FIRE-01", "station_name": "Central Fire Station Alpha"}
            },
            {
                "id": "usr_hospital_1",
                "email": "hospital@crisiscommand.org",
                "full_name": "Dr. Sarah Lin (Chief of Trauma)",
                "role": UserRole.HOSPITAL.value,
                "password_hash": get_password_hash("Password123!"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"hospital_id": "RES-HOSP-01", "hospital_name": "Metro Central General Hospital"}
            },
            {
                "id": "usr_citizen_1",
                "email": "citizen@crisiscommand.org",
                "full_name": "Alex Mercer",
                "role": UserRole.CITIZEN.value,
                "password_hash": get_password_hash("Password123!"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"phone": "+1-555-0199"}
            },
            {
                "id": "usr_admin_1",
                "email": "admin@crisiscommand.org",
                "full_name": "Admin Director Sarah",
                "role": UserRole.ADMIN.value,
                "password_hash": get_password_hash("Password123!"),
                "is_verified": True,
                "created_at": "2026-09-30T10:00:00Z",
                "metadata": {"clearance": "Level-5"}
            }
        ]
        for u in demo_accounts:
            self.users[u["email"]] = u

        # 2. Seed 5 Fire Teams
        fire_teams_data = [
            {"id": "RES-FIRE-01", "name": "Central Fire Station Alpha", "lat": BASE_LAT + 0.012, "lng": BASE_LNG + 0.008, "address": "104 MG Road Fire Station", "equipment": ["Heavy Engine 01", "Ladder Truck", "Hydraulic Extricator"]},
            {"id": "RES-FIRE-02", "name": "Metro West Fire Team B", "lat": BASE_LAT - 0.018, "lng": BASE_LNG - 0.014, "address": "45 West Avenue Depot", "equipment": ["Medium Engine 02", "Water Tender", "Smoke Extractor"]},
            {"id": "RES-FIRE-03", "name": "Highland Rescue Station 03", "lat": BASE_LAT + 0.028, "lng": BASE_LNG - 0.021, "address": "88 North Ring Fire Depot", "equipment": ["Rescue Engine 03", "Thermal Drone", "Hazmat Unit"]},
            {"id": "RES-FIRE-04", "name": "Harbor & Industrial Fire Unit", "lat": BASE_LAT - 0.032, "lng": BASE_LNG + 0.025, "address": "210 South Bypass", "equipment": ["Industrial Foam Cannon", "Heavy Extricator"]},
            {"id": "RES-FIRE-05", "name": "Suburban Fire Station 05", "lat": BASE_LAT + 0.038, "lng": BASE_LNG + 0.035, "address": "12 East Outer Loop", "equipment": ["Rapid Attack Vehicle", "Ladder Unit"]},
        ]
        for ft in fire_teams_data:
            self.resources[ft["id"]] = Resource(
                id=ft["id"],
                name=ft["name"],
                type=ResourceType.FIRE_TEAM,
                status=ResourceStatus.AVAILABLE,
                latitude=ft["lat"],
                longitude=ft["lng"],
                address=ft["address"],
                contact="+1-555-FIRE-" + ft["id"][-2:],
                capacity=4,
                available_units=4,
                specialization=["structural_fire", "hazmat", "rescue"],
                equipment=ft["equipment"],
                updated_at="2026-09-30T10:00:00Z"
            )

        # 3. Seed 5 Ambulances
        ambulances_data = [
            {"id": "RES-AMB-01", "name": "Ambulance Unit 01 (Advanced Life Support)", "lat": BASE_LAT + 0.005, "lng": BASE_LNG - 0.006, "address": "Station 1 Bay, Downtown"},
            {"id": "RES-AMB-02", "name": "Ambulance Unit 02 (Rapid Trauma)", "lat": BASE_LAT - 0.009, "lng": BASE_LNG + 0.012, "address": "Civic Hospital Outpost"},
            {"id": "RES-AMB-03", "name": "Ambulance Unit 03 (Critical Care)", "lat": BASE_LAT + 0.021, "lng": BASE_LNG + 0.015, "address": "Northpoint Junction"},
            {"id": "RES-AMB-04", "name": "Ambulance Unit 04 (Basic Life Support)", "lat": BASE_LAT - 0.025, "lng": BASE_LNG - 0.018, "address": "South Gate Center"},
            {"id": "RES-AMB-05", "name": "Ambulance Unit 05 (Mobile ICU)", "lat": BASE_LAT + 0.015, "lng": BASE_LNG - 0.030, "address": "Expressway Point 4"},
        ]
        for amb in ambulances_data:
            self.resources[amb["id"]] = Resource(
                id=amb["id"],
                name=amb["name"],
                type=ResourceType.AMBULANCE,
                status=ResourceStatus.AVAILABLE,
                latitude=amb["lat"],
                longitude=amb["lng"],
                address=amb["address"],
                contact="+1-555-AMB-" + amb["id"][-2:],
                capacity=2,
                available_units=2,
                specialization=["ALS", "trauma_care", "pediatric_life_support"],
                equipment=["Defibrillator", "Oxygen Unit", "Spine Board", "Telemetry"],
                updated_at="2026-09-30T10:00:00Z"
            )

        # 4. Seed 5 Hospitals
        hospitals_data = [
            {"id": "RES-HOSP-01", "name": "Metro Central General Hospital", "lat": BASE_LAT + 0.010, "lng": BASE_LNG + 0.018, "address": "500 Victoria Hospital Way", "beds": 14, "capacity": 20, "spec": ["Level-1 Trauma", "Burn Unit", "Neurosurgery"]},
            {"id": "RES-HOSP-02", "name": "St. Jude Emergency Trauma Center", "lat": BASE_LAT - 0.015, "lng": BASE_LNG - 0.008, "address": "77 St. Jude Boulevard", "beds": 8, "capacity": 15, "spec": ["Emergency Resuscitation", "Orthopedics"]},
            {"id": "RES-HOSP-03", "name": "Metro Burn & Acute Care Institute", "lat": BASE_LAT + 0.025, "lng": BASE_LNG - 0.010, "address": "120 Institute Parkway", "beds": 6, "capacity": 10, "spec": ["Advanced Burn Treatment", "Hyperbaric"]},
            {"id": "RES-HOSP-04", "name": "Memorial University Medical Center", "lat": BASE_LAT - 0.022, "lng": BASE_LNG + 0.020, "address": "33 University Avenue", "beds": 12, "capacity": 25, "spec": ["Cardiology", "Trauma", "ICU"]},
            {"id": "RES-HOSP-05", "name": "Northpoint Community Hospital", "lat": BASE_LAT + 0.032, "lng": BASE_LNG + 0.028, "address": "90 North Crest Way", "beds": 5, "capacity": 10, "spec": ["Urgent Care", "General Surgery"]},
        ]
        for hosp in hospitals_data:
            self.resources[hosp["id"]] = Resource(
                id=hosp["id"],
                name=hosp["name"],
                type=ResourceType.HOSPITAL,
                status=ResourceStatus.AVAILABLE,
                latitude=hosp["lat"],
                longitude=hosp["lng"],
                address=hosp["address"],
                contact="+1-555-HOSP-" + hosp["id"][-2:],
                capacity=hosp["capacity"],
                available_units=hosp["beds"],
                specialization=hosp["spec"],
                equipment=["CT Scanner", "Operating Theaters", "ICU Beds", "Blood Bank"],
                updated_at="2026-09-30T10:00:00Z"
            )

        # 5. Seed 10 Realistic Initial Incidents (Matching requirements: Fire #001 HIGH, Accident #002 MEDIUM, Fire #003 LOW, etc.)
        initial_incidents = [
            {
                "id": "INC-001",
                "title": "Commercial Complex Structural Fire",
                "incident_type": IncidentType.FIRE,
                "severity": IncidentSeverity.HIGH,
                "urgency": IncidentUrgency.CRITICAL,
                "status": IncidentStatus.ALLOCATED,
                "people_affected": 6,
                "lat": BASE_LAT + 0.008,
                "lng": BASE_LNG + 0.011,
                "address": "Grand Mall Plaza, 4th Floor Commercial Wing",
                "description": "Thick black smoke and flames billowing from 4th floor restaurant kitchen. Multiple employees evacuating, 6 people trapped near terrace exit.",
                "source_type": "citizen_report",
                "source_confidence": 0.96,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-002",
                "title": "Multi-Vehicle Collision on Eastern Expressway",
                "incident_type": IncidentType.ROAD_ACCIDENT,
                "severity": IncidentSeverity.MEDIUM,
                "urgency": IncidentUrgency.URGENT,
                "status": IncidentStatus.ALLOCATED,
                "people_affected": 3,
                "lat": BASE_LAT - 0.011,
                "lng": BASE_LNG + 0.014,
                "address": "Eastern Expressway Mile Marker 14",
                "description": "Two sedans and a light delivery truck collided in center lanes. Fluid leak on tarmac. 3 casualties with head and collar injuries, conscious.",
                "source_type": "cctv",
                "source_confidence": 0.98,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-003",
                "title": "Warehouse Yard Brush Fire",
                "incident_type": IncidentType.FIRE,
                "severity": IncidentSeverity.LOW,
                "urgency": IncidentUrgency.MODERATE,
                "status": IncidentStatus.ON_SCENE,
                "people_affected": 0,
                "lat": BASE_LAT + 0.024,
                "lng": BASE_LNG + 0.022,
                "address": "Industrial Logistics Park Yard 7",
                "description": "Discarded wooden pallets and dry brush caught fire along security perimeter fence. No structures threatened.",
                "source_type": "sensor",
                "source_confidence": 0.92,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-004",
                "title": "Pedestrian Struck by Motorcycle",
                "incident_type": IncidentType.ROAD_ACCIDENT,
                "severity": IncidentSeverity.MEDIUM,
                "urgency": IncidentUrgency.URGENT,
                "status": IncidentStatus.RESOLVED,
                "people_affected": 2,
                "lat": BASE_LAT - 0.006,
                "lng": BASE_LNG - 0.010,
                "address": "Corner of 5th Main & Market Road",
                "description": "Pedestrian struck while crossing crosswalk. Motorcyclist skidded 10 meters. Treated and stabilized at scene.",
                "source_type": "citizen_report",
                "source_confidence": 0.95,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-005",
                "title": "Residential Apartment Kitchen Fire",
                "incident_type": IncidentType.FIRE,
                "severity": IncidentSeverity.MEDIUM,
                "urgency": IncidentUrgency.URGENT,
                "status": IncidentStatus.RESOLVED,
                "people_affected": 2,
                "lat": BASE_LAT + 0.016,
                "lng": BASE_LNG - 0.015,
                "address": "Oakwood Heights Tower B Flat 302",
                "description": "Cooking oil fire contained by automated sprinkler system and resident extinguisher. Fire crew vented smoke.",
                "source_type": "citizen_report",
                "source_confidence": 0.94,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-006",
                "title": "Bus Stop Side-Impact Crash",
                "incident_type": IncidentType.ROAD_ACCIDENT,
                "severity": IncidentSeverity.HIGH,
                "urgency": IncidentUrgency.CRITICAL,
                "status": IncidentStatus.RESOLVED,
                "people_affected": 5,
                "lat": BASE_LAT + 0.020,
                "lng": BASE_LNG + 0.005,
                "address": "Central Terminal North Outer Bay",
                "description": "SUV lost control on wet pavement and struck transit passenger shelter.",
                "source_type": "operator_report",
                "source_confidence": 0.97,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-007",
                "title": "Electrical Transformer Sparking",
                "incident_type": IncidentType.FIRE,
                "severity": IncidentSeverity.LOW,
                "urgency": IncidentUrgency.MODERATE,
                "status": IncidentStatus.RESOLVED,
                "people_affected": 0,
                "lat": BASE_LAT - 0.020,
                "lng": BASE_LNG - 0.004,
                "address": "Utility Grid Substation 11",
                "description": "Overheating step-down transformer arcing. Power utility isolated feeder remotely.",
                "source_type": "sensor",
                "source_confidence": 0.99,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-008",
                "title": "Highway Rollover Accident",
                "incident_type": IncidentType.ROAD_ACCIDENT,
                "severity": IncidentSeverity.HIGH,
                "urgency": IncidentUrgency.CRITICAL,
                "status": IncidentStatus.RESOLVED,
                "people_affected": 4,
                "lat": BASE_LAT + 0.035,
                "lng": BASE_LNG - 0.012,
                "address": "North Highway Overpass Curve",
                "description": "Single-vehicle SUV rollover following tire blowout. Hydraulic rescue deployed.",
                "source_type": "cctv",
                "source_confidence": 0.95,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-009",
                "title": "Recycling Facility Scrap Fire",
                "incident_type": IncidentType.FIRE,
                "severity": IncidentSeverity.MEDIUM,
                "urgency": IncidentUrgency.URGENT,
                "status": IncidentStatus.RESOLVED,
                "people_affected": 1,
                "lat": BASE_LAT - 0.028,
                "lng": BASE_LNG + 0.018,
                "address": "EcoRecycle Compound Bay 3",
                "description": "Lithium battery thermal runaway in sorting pile. Smoldering managed with class-D fire suppression.",
                "source_type": "operator_report",
                "source_confidence": 0.91,
                "plan_version": "PLAN V1"
            },
            {
                "id": "INC-010",
                "title": "Rear-End Collision at Traffic Intersection",
                "incident_type": IncidentType.ROAD_ACCIDENT,
                "severity": IncidentSeverity.LOW,
                "urgency": IncidentUrgency.ROUTINE,
                "status": IncidentStatus.RESOLVED,
                "people_affected": 1,
                "lat": BASE_LAT + 0.002,
                "lng": BASE_LNG - 0.022,
                "address": "Intersection of Elm & 12th Avenue",
                "description": "Low-speed fender bender at red signal. Minor bumper damage, driver assessed for whiplash.",
                "source_type": "citizen_report",
                "source_confidence": 0.90,
                "plan_version": "PLAN V1"
            }
        ]

        for inc in initial_incidents:
            # Associate some incidents with usr_citizen_demo so demo citizen has active and history records
            reporter = "usr_citizen_demo" if inc["id"] in ["INC-001", "INC-004", "INC-005", "INC-010"] else "usr_citizen_1"
            incident_obj = Incident(
                id=inc["id"],
                incident_type=inc["incident_type"],
                title=inc["title"],
                description=inc["description"],
                severity=inc["severity"],
                urgency=inc["urgency"],
                status=inc["status"],
                people_affected=inc["people_affected"],
                latitude=inc["lat"],
                longitude=inc["lng"],
                address=inc["address"],
                reported_by_id=reporter,
                source_type=inc["source_type"],
                source_confidence=inc["source_confidence"],
                current_plan_version=inc["plan_version"],
                created_at="2026-09-30T10:30:00Z",
                updated_at="2026-09-30T10:35:00Z"
            )
            # Add initial timeline
            incident_obj.timeline = [
                {"timestamp": "2026-09-30T10:30:00Z", "event": "Incident reported by source", "details": f"Type: {inc['incident_type'].value}, Reported affected: {inc['people_affected']}"},
                {"timestamp": "2026-09-30T10:30:30Z", "event": "AI Assessment completed", "details": f"Severity: {inc['severity'].value}, Urgency: {inc['urgency'].value}"},
                {"timestamp": "2026-09-30T10:31:00Z", "event": "Response Plan V1 generated & automatically activated", "details": "Autonomous execution engine assigned optimal nearby units"}
            ]
            self.incidents[inc["id"]] = incident_obj

        # Assign initial active assignments for INC-001 and INC-002
        # INC-001 gets Fire Station 01 + Ambulance 01 + Hospital 01
        plan1_id = "PLAN-" + str(uuid.uuid4())[:8]
        # Compute distances/ETAs from actual seeded coordinates (haversine from resource → incident)
        import math as _math
        def _hav(lat1, lon1, lat2, lon2):
            R = 6371.0
            d = _math.radians
            dlat = d(lat2 - lat1); dlon = d(lon2 - lon1)
            a = _math.sin(dlat/2)**2 + _math.cos(d(lat1)) * _math.cos(d(lat2)) * _math.sin(dlon/2)**2
            return round(R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1-a)), 2)
        def _eta(dist, rtype, spd):
            return round(max((dist / spd) * 60.0 + 1.0, 1.5), 1)

        # INC-001: BASE_LAT+0.008, BASE_LNG+0.011
        inc1_lat = BASE_LAT + 0.008; inc1_lng = BASE_LNG + 0.011
        # RES-FIRE-01: BASE_LAT+0.012, BASE_LNG+0.008
        d1 = _hav(BASE_LAT+0.012, BASE_LNG+0.008, inc1_lat, inc1_lng)
        # RES-AMB-01: BASE_LAT+0.005, BASE_LNG-0.006
        d2 = _hav(BASE_LAT+0.005, BASE_LNG-0.006, inc1_lat, inc1_lng)
        # RES-HOSP-01: BASE_LAT+0.010, BASE_LNG+0.018
        d3 = _hav(BASE_LAT+0.010, BASE_LNG+0.018, inc1_lat, inc1_lng)

        asg1 = Assignment(
            id="ASG-001",
            incident_id="INC-001",
            plan_id=plan1_id,
            resource_id="RES-FIRE-01",
            resource_name="Central Fire Station Alpha",
            resource_type=ResourceType.FIRE_TEAM,
            status="DISPATCHED",
            response_status="ASSIGNED",
            eta_minutes=_eta(d1, "fire_team", 38.0),
            distance_km=d1,
            route_summary="Via MG Road Direct Corridor",
            assigned_at="2026-09-30T10:31:00Z",
            updated_at="2026-09-30T10:31:00Z"
        )
        asg2 = Assignment(
            id="ASG-002",
            incident_id="INC-001",
            plan_id=plan1_id,
            resource_id="RES-AMB-01",
            resource_name="Ambulance Unit 01 (Advanced Life Support)",
            resource_type=ResourceType.AMBULANCE,
            status="DISPATCHED",
            response_status="ASSIGNED",
            eta_minutes=_eta(d2, "ambulance", 45.0),
            distance_km=d2,
            route_summary="Via Downtown Arterial",
            assigned_at="2026-09-30T10:31:00Z",
            updated_at="2026-09-30T10:31:00Z"
        )
        asg3 = Assignment(
            id="ASG-003",
            incident_id="INC-001",
            plan_id=plan1_id,
            resource_id="RES-HOSP-01",
            resource_name="Metro Central General Hospital",
            resource_type=ResourceType.HOSPITAL,
            status="DISPATCHED",
            response_status="ASSIGNED",
            eta_minutes=_eta(d3, "hospital", 40.0),
            distance_km=d3,
            route_summary="Trauma Bay 1 & 2 Reserved",
            assigned_at="2026-09-30T10:31:00Z",
            updated_at="2026-09-30T10:31:00Z"
        )
        plan1 = ResponsePlan(
            id=plan1_id,
            incident_id="INC-001",
            version="PLAN V1",
            status="ACTIVE",
            assignments=[asg1, asg2, asg3],
            change_reason="Initial automated response plan generation for Commercial Fire",
            why_plan_changed=["Initial response dispatch", "Multi-unit dispatch for high severity"],
            triggered_by="AUTOMATIC_MULTI_AGENT_ENGINE",
            created_at="2026-09-30T10:31:00Z",
            activated_at="2026-09-30T10:31:00Z"
        )
        self.response_plans[plan1_id] = plan1
        self.incidents["INC-001"].plans.append(plan1)
        self.incidents["INC-001"].current_plan_id = plan1_id
        self.assignments[asg1.id] = asg1
        self.assignments[asg2.id] = asg2
        self.assignments[asg3.id] = asg3

        # Mark resources as assigned
        self.resources["RES-FIRE-01"].status = ResourceStatus.DISPATCHED
        self.resources["RES-FIRE-01"].current_incident_id = "INC-001"
        self.resources["RES-AMB-01"].status = ResourceStatus.DISPATCHED
        self.resources["RES-AMB-01"].current_incident_id = "INC-001"

        # INC-002 assignments — compute distances from actual seeded coordinates
        plan2_id = "PLAN-" + str(uuid.uuid4())[:8]
        inc2_lat = BASE_LAT - 0.011; inc2_lng = BASE_LNG + 0.014
        d4 = _hav(BASE_LAT-0.009, BASE_LNG+0.012, inc2_lat, inc2_lng)
        d5 = _hav(BASE_LAT-0.015, BASE_LNG-0.008, inc2_lat, inc2_lng)
        d_fire2 = _hav(BASE_LAT+0.012, BASE_LNG+0.008, inc2_lat, inc2_lng)
        asg4 = Assignment(
            id="ASG-004",
            incident_id="INC-002",
            plan_id=plan2_id,
            resource_id="RES-AMB-02",
            resource_name="Ambulance Unit 02 (Rapid Trauma)",
            resource_type=ResourceType.AMBULANCE,
            status="DISPATCHED",
            response_status="ASSIGNED",
            eta_minutes=_eta(d4, "ambulance", 45.0),
            distance_km=d4,
            route_summary="Via Eastern Expressway Access Slip",
            assigned_at="2026-09-30T10:32:00Z",
            updated_at="2026-09-30T10:32:00Z"
        )
        asg5 = Assignment(
            id="ASG-005",
            incident_id="INC-002",
            plan_id=plan2_id,
            resource_id="RES-HOSP-02",
            resource_name="St. Jude Emergency Trauma Center",
            resource_type=ResourceType.HOSPITAL,
            status="PREPARING",
            response_status="ACCEPTED",
            eta_minutes=_eta(d5, "hospital", 40.0),
            distance_km=d5,
            route_summary="Receiving Bay Prepared",
            assigned_at="2026-09-30T10:32:00Z",
            updated_at="2026-09-30T10:32:00Z"
        )
        asg6 = Assignment(
            id="ASG-006",
            incident_id="INC-002",
            plan_id=plan2_id,
            resource_id="RES-FIRE-01",
            resource_name="Central Fire Station Alpha",
            resource_type=ResourceType.FIRE_TEAM,
            status="ACCEPTED",
            response_status="ACCEPTED",
            eta_minutes=_eta(d_fire2, "fire_team", 38.0),
            distance_km=d_fire2,
            route_summary="Via Arterial Highway 2",
            assigned_at="2026-09-30T10:32:00Z",
            updated_at="2026-09-30T10:33:00Z"
        )
        plan2 = ResponsePlan(
            id=plan2_id,
            incident_id="INC-002",
            version="PLAN V1",
            status="ACTIVE",
            assignments=[asg4, asg5, asg6],
            change_reason="Automated allocation for 3 casualties on Eastern Expressway",
            why_plan_changed=["Initial response dispatch"],
            triggered_by="AUTOMATIC_MULTI_AGENT_ENGINE",
            created_at="2026-09-30T10:32:00Z",
            activated_at="2026-09-30T10:32:00Z"
        )
        self.response_plans[plan2_id] = plan2
        self.incidents["INC-002"].plans.append(plan2)
        self.incidents["INC-002"].current_plan_id = plan2_id
        self.assignments[asg4.id] = asg4
        self.assignments[asg5.id] = asg5
        self.assignments[asg6.id] = asg6
        self.resources["RES-AMB-02"].status = ResourceStatus.DISPATCHED
        self.resources["RES-AMB-02"].current_incident_id = "INC-002"

        # INC-003 assignments: Warehouse Brush Fire (ON_SCENE)
        plan3_id = "PLAN-" + str(uuid.uuid4())[:8]
        asg7 = Assignment(
            id="ASG-007",
            incident_id="INC-003",
            plan_id=plan3_id,
            resource_id="RES-FIRE-01",
            resource_name="Central Fire Station Alpha",
            resource_type=ResourceType.FIRE_TEAM,
            status="ON_SCENE",
            response_status="ACCEPTED",
            eta_minutes=0.0,
            distance_km=2.4,
            route_summary="Via Industrial Ring Expressway",
            assigned_at="2026-09-30T09:15:00Z",
            updated_at="2026-09-30T09:25:00Z"
        )
        plan3 = ResponsePlan(
            id=plan3_id,
            incident_id="INC-003",
            version="PLAN V1",
            status="ACTIVE",
            assignments=[asg7],
            change_reason="Initial automated dispatch for low brush fire",
            triggered_by="AUTOMATIC_MULTI_AGENT_ENGINE",
            created_at="2026-09-30T09:15:00Z",
            activated_at="2026-09-30T09:15:00Z"
        )
        self.response_plans[plan3_id] = plan3
        self.incidents["INC-003"].plans.append(plan3)
        self.incidents["INC-003"].current_plan_id = plan3_id
        self.assignments[asg7.id] = asg7

        # Seed real history assignments for INC-004 through INC-010 (Resolved incidents)
        history_plans_data = [
            ("INC-004", "RES-HOSP-01", "Metro Central General Hospital", ResourceType.HOSPITAL, "RESOLVED", "2026-09-30T08:00:00Z", "2026-09-30T08:35:00Z", 1.8),
            ("INC-005", "RES-FIRE-01", "Central Fire Station Alpha", ResourceType.FIRE_TEAM, "RESOLVED", "2026-09-30T07:20:00Z", "2026-09-30T08:05:00Z", 2.2),
            ("INC-005", "RES-HOSP-01", "Metro Central General Hospital", ResourceType.HOSPITAL, "RESOLVED", "2026-09-30T07:20:00Z", "2026-09-30T08:10:00Z", 2.5),
            ("INC-006", "RES-HOSP-01", "Metro Central General Hospital", ResourceType.HOSPITAL, "RESOLVED", "2026-09-29T16:00:00Z", "2026-09-29T17:15:00Z", 3.1),
            ("INC-007", "RES-FIRE-01", "Central Fire Station Alpha", ResourceType.FIRE_TEAM, "RESOLVED", "2026-09-29T14:10:00Z", "2026-09-29T14:50:00Z", 1.5),
            ("INC-008", "RES-FIRE-01", "Central Fire Station Alpha", ResourceType.FIRE_TEAM, "RESOLVED", "2026-09-28T11:00:00Z", "2026-09-28T12:30:00Z", 4.2),
            ("INC-008", "RES-HOSP-01", "Metro Central General Hospital", ResourceType.HOSPITAL, "RESOLVED", "2026-09-28T11:00:00Z", "2026-09-28T12:45:00Z", 3.8),
            ("INC-009", "RES-FIRE-01", "Central Fire Station Alpha", ResourceType.FIRE_TEAM, "RESOLVED", "2026-09-27T09:30:00Z", "2026-09-27T10:45:00Z", 2.9),
            ("INC-009", "RES-HOSP-01", "Metro Central General Hospital", ResourceType.HOSPITAL, "REJECTED", "2026-09-27T09:30:00Z", "2026-09-27T09:35:00Z", 3.0),
            ("INC-010", "RES-HOSP-01", "Metro Central General Hospital", ResourceType.HOSPITAL, "RESOLVED", "2026-09-26T18:00:00Z", "2026-09-26T18:40:00Z", 1.2),
        ]
        for idx, (inc_id, res_id, res_name, res_type, st, asg_time, upd_time, dist) in enumerate(history_plans_data):
            p_id = f"PLAN-HIST-{inc_id}"
            asg_item = Assignment(
                id=f"ASG-HIST-{idx+10}",
                incident_id=inc_id,
                plan_id=p_id,
                resource_id=res_id,
                resource_name=res_name,
                resource_type=res_type,
                status=st,
                response_status=st,
                eta_minutes=0.0,
                distance_km=dist,
                route_summary="Primary Arterial Route Completed",
                assigned_at=asg_time,
                updated_at=upd_time
            )
            self.assignments[asg_item.id] = asg_item
            if inc_id in self.incidents:
                hist_plan = ResponsePlan(
                    id=p_id,
                    incident_id=inc_id,
                    version="PLAN V1",
                    status="COMPLETED" if st == "RESOLVED" else "SUPERSEDED",
                    assignments=[asg_item],
                    change_reason="Completed emergency assignment",
                    triggered_by="AUTOMATIC_MULTI_AGENT_ENGINE",
                    created_at=asg_time,
                    activated_at=asg_time
                )
                self.incidents[inc_id].plans.append(hist_plan)
                self.incidents[inc_id].current_plan_id = p_id

        # Seed initial notifications
        self.notifications.append(Notification(
            id="NOTIF-001",
            recipient_role="COMMANDER",
            title="Commercial Complex Fire - Plan V1 Active",
            message="Plan V1 automatically executed. Station Alpha & Ambulance 01 dispatched to Mall Plaza.",
            incident_id="INC-001",
            plan_version="PLAN V1",
            type="ALERT",
            created_at="2026-09-30T10:31:05Z"
        ))
        self.notifications.append(Notification(
            id="NOTIF-002",
            recipient_role="FIRE_TEAM",
            resource_id="RES-FIRE-01",
            title="Dispatch Order: Fire #001",
            message=f"Proceed to Grand Mall Plaza. ETA {_eta(d1, 'fire_team', 38.0)} minutes. 6 people at risk.",
            incident_id="INC-001",
            plan_version="PLAN V1",
            type="CRITICAL",
            created_at="2026-09-30T10:31:05Z"
        ))
        self.notifications.append(Notification(
            id="NOTIF-003",
            recipient_role="HOSPITAL",
            resource_id="RES-HOSP-01",
            title="Inbound Emergency Notification: Fire Casualties Expected",
            message="Metro General: Prepare 2 burn trauma bays for incoming casualties from INC-001.",
            incident_id="INC-001",
            plan_version="PLAN V1",
            type="INFO",
            created_at="2026-09-30T10:31:10Z"
        ))
        self.notifications.append(Notification(
            id="NOTIF-004",
            recipient_role="CITIZEN",
            recipient_user_id="usr_citizen_demo",
            title="Emergency Dispatched: Fire #001",
            message="Central Fire Station Alpha and Ambulance 01 have been dispatched to your emergency location.",
            incident_id="INC-001",
            plan_version="PLAN V1",
            type="SUCCESS",
            status="DELIVERED",
            created_at="2026-09-30T10:31:05Z"
        ))
        self.notifications.append(Notification(
            id="NOTIF-005",
            recipient_role="CITIZEN",
            recipient_user_id="usr_citizen_1",
            title="Emergency Dispatched: Fire #001",
            message="Central Fire Station Alpha and Ambulance 01 have been dispatched to your emergency location.",
            incident_id="INC-001",
            plan_version="PLAN V1",
            type="SUCCESS",
            status="DELIVERED",
            created_at="2026-09-30T10:31:05Z"
        ))
        self.notifications.append(Notification(
            id="NOTIF-006",
            recipient_role="FIRE_TEAM",
            resource_id="RES-FIRE-01",
            title="Dispatch Order: Collision #002",
            message="Eastern Expressway Mile Marker 14: Multi-vehicle crash with extrication gear needed.",
            incident_id="INC-002",
            plan_version="PLAN V1",
            type="ALERT",
            status="ACCEPTED",
            read=True,
            created_at="2026-09-30T10:32:05Z"
        ))
        self.notifications.append(Notification(
            id="NOTIF-007",
            recipient_role="HOSPITAL",
            resource_id="RES-HOSP-01",
            title="Casualty Intake Resolved: INC-004",
            message="Pedestrian casualty from Market Road safely stabilized and admitted to Orthopedics.",
            incident_id="INC-004",
            plan_version="PLAN V1",
            type="SUCCESS",
            status="RESOLVED",
            read=True,
            created_at="2026-09-30T08:35:00Z"
        ))

        # Seed initial Audit Logs
        self.audit_logs.append(AuditLog(
            id="AUD-001",
            user_id="SYSTEM_ENGINE",
            user_name="Autonomous Multi-Agent Coordinator",
            role="SYSTEM",
            action="PLAN_AUTO_ACTIVATED",
            previous_value="NONE",
            new_value="PLAN V1",
            reason="Autonomous optimization matched Central Fire Station Alpha & Ambulance 01 with lowest composite ETA (4.5m)",
            plan_version="PLAN V1",
            incident_id="INC-001",
            timestamp="2026-09-30T10:31:00Z"
        ))
        self.audit_logs.append(AuditLog(
            id="AUD-002",
            user_id="SYSTEM_ENGINE",
            user_name="Autonomous Multi-Agent Coordinator",
            role="SYSTEM",
            action="RESOURCE_ASSIGNED",
            previous_value="AVAILABLE",
            new_value="DISPATCHED",
            reason="Dispatched to Commercial Complex Fire INC-001",
            plan_version="PLAN V1",
            incident_id="INC-001",
            timestamp="2026-09-30T10:31:05Z"
        ))

# Global database instance
db = Database()
