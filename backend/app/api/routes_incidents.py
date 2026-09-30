from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from app.models.schemas import (
    Incident, IncidentCreateRequest, IncidentStatus, IncidentSeverity, IncidentType,
    Notification, AuditLog, ResourceStatus
)
from app.core.database import db
from app.core.security import get_current_user
from app.agents.graph import multi_agent_coordinator
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.post("", response_model=Incident)
async def create_incident(
    req: IncidentCreateRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    Reports emergency and automatically executes response without confirmation gates!
    Associates the incident with the authenticated citizen ID if logged in.
    """
    # Enforce authenticated identity if available
    reporter_id = req.reported_by_id
    if current_user:
        reporter_id = current_user.get("id") or current_user.get("email")
    if not reporter_id:
        reporter_id = "usr_citizen_demo"

    incident = multi_agent_coordinator.process_new_incident(req, reported_by_id=reporter_id)

    # Real-time WebSocket broadcasts
    await ws_manager.broadcast("INCIDENT_CREATED", incident.model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast_targeted_notifications()

    return incident

@router.get("", response_model=List[Incident])
def get_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    incident_type: Optional[str] = None,
    reported_by_id: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    Returns incidents.
    If authenticated as a Citizen, strictly scopes results to the citizen's own reported emergencies.
    """
    incidents = list(db.incidents.values())

    if current_user:
        u_role = (current_user.get("role") or "").upper()
        u_id = current_user.get("id")
        u_email = current_user.get("email")

        # Citizen privacy enforcement (Section 14: A citizen must NOT see another citizen's incident)
        if u_role == "CITIZEN":
            allowed_reporters = {u_id, u_email}
            if u_id in ["usr_citizen_demo", "usr_citizen_1"] or u_email in ["citizen@crisiscommand.demo", "citizen@crisiscommand.org"]:
                allowed_reporters.update({"usr_citizen_demo", "usr_citizen_1", "citizen@crisiscommand.demo", "citizen@crisiscommand.org"})
            incidents = [
                i for i in incidents
                if i.reported_by_id in allowed_reporters or (not i.reported_by_id and u_id in ["usr_citizen_demo", "usr_citizen_1"])
            ]
        elif reported_by_id and u_role in ["ADMIN", "COMMANDER", "DISPATCHER"]:
            incidents = [i for i in incidents if i.reported_by_id == reported_by_id]
    elif reported_by_id:
        incidents = [i for i in incidents if i.reported_by_id == reported_by_id]

    if status:
        incidents = [i for i in incidents if i.status.value.upper() == status.upper()]
    if severity:
        incidents = [i for i in incidents if i.severity.value.upper() == severity.upper()]
    if incident_type:
        incidents = [i for i in incidents if i.incident_type.value.lower() == incident_type.lower()]

    # Return newest first
    incidents.sort(key=lambda x: x.created_at, reverse=True)
    return incidents

@router.get("/{id}", response_model=Incident)
def get_incident(id: str, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    incident = db.incidents.get(id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")

    if current_user:
        u_role = (current_user.get("role") or "").upper()
        if u_role == "CITIZEN":
            u_id = current_user.get("id")
            u_email = current_user.get("email")
            allowed_reporters = {u_id, u_email}
            if u_id in ["usr_citizen_demo", "usr_citizen_1"] or u_email in ["citizen@crisiscommand.demo", "citizen@crisiscommand.org"]:
                allowed_reporters.update({"usr_citizen_demo", "usr_citizen_1", "citizen@crisiscommand.demo", "citizen@crisiscommand.org"})
            if incident.reported_by_id not in allowed_reporters:
                raise HTTPException(status_code=403, detail="Unauthorized to view this incident record.")

    return incident

@router.patch("/{id}", response_model=Incident)
async def update_incident_status(
    id: str,
    new_status: IncidentStatus,
    notes: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Responder status update (e.g. EN_ROUTE, ON_SCENE, RESOLVED) — executes immediately."""
    incident = db.incidents.get(id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")

    old_status = incident.status.value
    incident.status = new_status
    now_str = datetime.utcnow().isoformat() + "Z"
    incident.updated_at = now_str

    incident.timeline.append({
        "timestamp": now_str,
        "event": f"Status updated to {new_status.value}",
        "details": notes or f"Field operation transitioned from {old_status} to {new_status.value}"
    })

    # If resolved, free up resources
    if new_status == IncidentStatus.RESOLVED:
        for r in db.resources.values():
            if r.current_incident_id == incident.id:
                r.status = ResourceStatus.AVAILABLE
                r.current_incident_id = None

    await ws_manager.broadcast("INCIDENT_UPDATED", incident.model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast_targeted_notifications()

    return incident
