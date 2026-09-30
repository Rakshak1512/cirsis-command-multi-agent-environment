from typing import List, Optional, Dict, Any, Union
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime

class UserRole(str, Enum):
    CITIZEN = "CITIZEN"
    FIRE_TEAM = "FIRE_TEAM"
    HOSPITAL = "HOSPITAL"
    COMMANDER = "COMMANDER"
    DISPATCHER = "DISPATCHER"
    ADMIN = "ADMIN"

class IncidentType(str, Enum):
    FIRE = "fire"
    ROAD_ACCIDENT = "road_accident"

class IncidentSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class IncidentUrgency(str, Enum):
    CRITICAL = "CRITICAL"
    URGENT = "URGENT"
    MODERATE = "MODERATE"
    ROUTINE = "ROUTINE"

class IncidentStatus(str, Enum):
    REPORTED = "REPORTED"
    ASSESSED = "ASSESSED"
    ALLOCATED = "ALLOCATED"
    EN_ROUTE = "EN_ROUTE"
    ON_SCENE = "ON_SCENE"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"

class ResourceType(str, Enum):
    FIRE_TEAM = "fire_team"
    AMBULANCE = "ambulance"
    HOSPITAL = "hospital"

class ResourceStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    DISPATCHED = "DISPATCHED"
    BUSY = "BUSY"
    UNAVAILABLE = "UNAVAILABLE"

# User Auth Schemas
class UserRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRole
    # Optional Station / Hospital / Admin specific metadata
    station_name: Optional[str] = None
    station_id: Optional[str] = None
    team_leader_name: Optional[str] = None
    hospital_name: Optional[str] = None
    hospital_id: Optional[str] = None
    contact: Optional[str] = None
    location_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    number_of_teams: Optional[int] = 1
    emergency_capacity: Optional[int] = 10
    available_beds: Optional[int] = 5
    icu_beds: Optional[int] = 2
    ambulance_capacity: Optional[int] = 2
    equipment: Optional[List[str]] = []
    specializations: Optional[List[str]] = []
    organization: Optional[str] = None
    admin_code: Optional[str] = None

class OTPVerifyRequest(BaseModel):
    email: str
    otp: str

class UserLoginRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = None
    selected_role: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    is_verified: bool
    created_at: str
    organization_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Resource Schema
class Resource(BaseModel):
    id: str
    name: str
    type: ResourceType
    status: ResourceStatus
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None
    last_location_update: Optional[str] = None
    is_live_location: bool = False
    address: str
    contact: str
    current_incident_id: Optional[str] = None
    current_assignment: Optional[str] = None
    capacity: int = 1
    available_units: int = 1
    specialization: Optional[List[str]] = []
    equipment: Optional[List[str]] = []
    updated_at: str

# Incident Schemas
class LocationPoint(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = "Unknown Location"

class IncidentCreateRequest(BaseModel):
    incident_type: IncidentType
    description: str
    people_affected: int = 1
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180")
    accuracy: Optional[float] = Field(None, ge=0.0, description="GPS Accuracy in meters")
    location_captured_at: Optional[str] = None  # ISO timestamp when citizen GPS was captured
    address: Optional[str] = "Incident Location"
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    source_type: Optional[str] = "citizen_report" # citizen_report, operator_report, cctv, sensor
    source_confidence: Optional[float] = 0.95
    reported_by_id: Optional[str] = None

class IncidentAssessment(BaseModel):
    incident_type: IncidentType
    severity: IncidentSeverity
    urgency: IncidentUrgency
    people_at_risk: int
    vehicles_involved: Optional[int] = 0
    burn_hazard: Optional[bool] = False
    extrication_needed: Optional[bool] = False
    required_resources: List[str] # ["fire_team", "ambulance", "hospital"]
    hospital_specialization: Optional[List[str]] = []
    reasoning: List[str]
    source_conflict: Optional[bool] = False
    conflict_notes: Optional[str] = None
    confidence_score: float = 0.95

class Assignment(BaseModel):
    id: str
    incident_id: str
    plan_id: str
    resource_id: str
    resource_name: str
    resource_type: ResourceType
    status: str = "DISPATCHED" # ASSIGNED, ACCEPTED, REJECTED, EN_ROUTE, ARRIVED, RESPONDING, RESOLVED
    response_status: Optional[str] = "ASSIGNED" # ASSIGNED, ACCEPTED, REJECTED
    eta_minutes: float
    distance_km: float
    route_summary: str
    assigned_at: str
    updated_at: str

class ResponsePlan(BaseModel):
    id: str
    incident_id: str
    version: str # PLAN V1, PLAN V2, etc.
    status: str = "ACTIVE" # ACTIVE, SUPERSEDED, COMPLETED
    assignments: List[Assignment] = []
    alternative_resources: List[Dict[str, Any]] = []
    change_reason: Optional[str] = "Initial automated response plan generation"
    why_plan_changed: Optional[List[str]] = []
    triggered_by: str = "AUTOMATIC_ENGINE"
    created_at: str
    activated_at: str

class Incident(BaseModel):
    id: str
    incident_type: IncidentType
    title: str
    description: str
    severity: IncidentSeverity
    urgency: IncidentUrgency
    status: IncidentStatus
    people_affected: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    location_captured_at: Optional[str] = None  # ISO timestamp of citizen GPS capture
    address: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    reported_by_id: Optional[str] = None
    source_type: str = "citizen_report"
    source_confidence: float = 0.95
    assessment: Optional[IncidentAssessment] = None
    current_plan_id: Optional[str] = None
    current_plan_version: Optional[str] = "PLAN V1"
    plans: List[ResponsePlan] = []
    timeline: List[Dict[str, Any]] = []
    created_at: str
    updated_at: str

    # Direct compatibility accessors matching Part 7 specification
    @property
    def citizenId(self) -> Optional[str]:
        return self.reported_by_id

    @property
    def type(self) -> str:
        return self.incident_type.value

    @property
    def peopleAffected(self) -> int:
        return self.people_affected

    @property
    def requiredResources(self) -> List[str]:
        return self.assessment.required_resources if self.assessment else []

    @property
    def assignedResources(self) -> List[Dict[str, Any]]:
        for p in reversed(self.plans):
            if p.status == "ACTIVE":
                return [a.model_dump() for a in p.assignments]
        return []

    @property
    def responsePlanId(self) -> Optional[str]:
        return self.current_plan_id

    @property
    def currentPlanVersion(self) -> Optional[str]:
        return self.current_plan_version

    @property
    def createdAt(self) -> str:
        return self.created_at

    @property
    def updatedAt(self) -> str:
        return self.updated_at

class Notification(BaseModel):
    id: str
    recipient_role: Optional[str] = "ALL"
    recipient_user_id: Optional[str] = None
    resource_id: Optional[str] = None
    title: str
    message: str
    incident_id: Optional[str] = None
    plan_version: Optional[str] = None
    type: str = "INFO" # CRITICAL, ALERT, SUCCESS, INFO
    status: str = "PENDING" # PENDING, DELIVERED, READ, ACCEPTED, REJECTED, EXPIRED
    read: bool = False
    created_at: str

class AuditLog(BaseModel):
    id: str
    user_id: str
    user_name: str
    role: str
    action: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None
    plan_version: Optional[str] = None
    incident_id: Optional[str] = None
    timestamp: str

class CommanderOverrideRequest(BaseModel):
    incident_id: str
    action_type: str # REASSIGN_RESOURCE, CANCEL_ASSIGNMENT, CHANGE_PRIORITY, CHANGE_SEVERITY, MARK_UNAVAILABLE, TRIGGER_REPLAN
    resource_id: Optional[str] = None
    new_resource_id: Optional[str] = None
    new_severity: Optional[IncidentSeverity] = None
    reason: str

class ResourceLocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy: Optional[float] = Field(None, ge=0.0)
    heading: Optional[float] = None
    speed: Optional[float] = None
    timestamp: Optional[Union[float, str]] = None

class AssignmentActionRequest(BaseModel):
    action: str = Field(..., description="ACCEPT or REJECT")
    reason: Optional[str] = None
    notes: Optional[str] = None
