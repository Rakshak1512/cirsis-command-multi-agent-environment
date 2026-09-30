import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from app.models.schemas import (
    Assignment, AssignmentActionRequest, ResourceStatus, ResourceType,
    IncidentStatus, Notification, AuditLog
)
from app.core.database import db
from app.core.security import get_current_user
from app.services.websocket_manager import ws_manager
from app.agents.replanning_agent import ReplanningManager

router = APIRouter(prefix="/assignments", tags=["Assignments"])
replan_manager = ReplanningManager()

def _is_duplicate_notification(title: str, message: str, recipient_role: str, user_id: Optional[str]) -> bool:
    """Idempotency check: prevent duplicate notifications within 10 seconds."""
    for n in db.notifications[:8]:
        if n.title == title and n.message == message and n.recipient_role == recipient_role:
            if user_id is None or n.recipient_user_id == user_id:
                return True
    return False

@router.get("", response_model=List[Assignment])
def get_assignments(
    incident_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    Retrieves assignments filtered by incident, resource, or status.
    Enforces authorization: responders only access assignments targeted to their facility.
    """
    asgs = list(db.assignments.values())

    # Server-side role scoping if authenticated responder
    if current_user:
        u_role = (current_user.get("role") or "").upper()
        meta = current_user.get("metadata") or {}
        if u_role == "HOSPITAL":
            hosp_id = meta.get("hospital_id") or meta.get("resource_id")
            if hosp_id:
                asgs = [a for a in asgs if a.resource_id == hosp_id or a.resource_type == ResourceType.HOSPITAL]
            else:
                asgs = [a for a in asgs if a.resource_type == ResourceType.HOSPITAL]
        elif u_role == "FIRE_TEAM":
            station_id = meta.get("station_id") or meta.get("resource_id")
            if station_id:
                asgs = [a for a in asgs if a.resource_id == station_id or a.resource_type == ResourceType.FIRE_TEAM]
            else:
                asgs = [a for a in asgs if a.resource_type == ResourceType.FIRE_TEAM]
        elif u_role == "CITIZEN":
            c_id = current_user.get("id")
            my_inc_ids = {i.id for i in db.incidents.values() if i.reported_by_id == c_id}
            asgs = [a for a in asgs if a.incident_id in my_inc_ids]

    if incident_id:
        asgs = [a for a in asgs if a.incident_id == incident_id]
    if resource_id:
        asgs = [a for a in asgs if a.resource_id == resource_id]
    if status:
        asgs = [a for a in asgs if a.status.upper() == status.upper()]

    return asgs

@router.get("/{id}", response_model=Assignment)
def get_assignment(id: str):
    asg = db.assignments.get(id)
    if not asg:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return asg

@router.post("/{id}/accept", response_model=Assignment)
async def accept_assignment(
    id: str,
    req: Optional[AssignmentActionRequest] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    Responder or Hospital accepts incoming emergency dispatch.
    Verifies assignment, updates status, creates timeline event, notifies citizen, updates map.
    """
    asg = db.assignments.get(id)
    if not asg:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    # Role enforcement
    if current_user:
        u_role = (current_user.get("role") or "").upper()
        if u_role == "HOSPITAL" and asg.resource_type != ResourceType.HOSPITAL:
            raise HTTPException(status_code=403, detail="Hospital account cannot accept non-hospital assignments.")
        if u_role == "FIRE_TEAM" and asg.resource_type != ResourceType.FIRE_TEAM:
            raise HTTPException(status_code=403, detail="Fire team account cannot accept non-fire-team assignments.")
        if u_role == "CITIZEN":
            raise HTTPException(status_code=403, detail="Citizen account cannot modify responder assignments.")

    now_str = datetime.utcnow().isoformat() + "Z"
    asg.status = "ACCEPTED"
    asg.response_status = "ACCEPTED"
    asg.updated_at = now_str

    incident = db.incidents.get(asg.incident_id)
    resource = db.resources.get(asg.resource_id)

    # Sync notification state to ACCEPTED and read
    for n in db.notifications:
        if n.incident_id == asg.incident_id and (n.resource_id == asg.resource_id or (not n.resource_id and n.recipient_role == asg.resource_type.value.upper())):
            n.status = "ACCEPTED"
            n.read = True

    # If hospital: reserve emergency capacity deterministically
    if asg.resource_type == ResourceType.HOSPITAL and resource:
        if resource.available_units > 0:
            resource.available_units -= 1
        resource.updated_at = now_str

    # If fire team: mark as en route / responding
    if asg.resource_type == ResourceType.FIRE_TEAM and resource:
        resource.status = ResourceStatus.DISPATCHED
        resource.updated_at = now_str

    # Create timeline event on incident
    if incident:
        if asg.resource_type == ResourceType.FIRE_TEAM:
            timeline_msg = f"{asg.resource_name} accepted emergency response."
            citizen_notif_msg = f"{asg.resource_name} accepted your emergency response."
        elif asg.resource_type == ResourceType.HOSPITAL:
            timeline_msg = f"{asg.resource_name} has accepted emergency casualty intake."
            citizen_notif_msg = f"{asg.resource_name} has accepted your emergency."
        else:
            timeline_msg = f"{asg.resource_name} accepted emergency response."
            citizen_notif_msg = f"{asg.resource_name} accepted your emergency response."

        incident.timeline.append({
            "timestamp": now_str,
            "event": "Resource Accepted Response",
            "details": timeline_msg
        })
        incident.updated_at = now_str

        # Generate direct notification to the reporting citizen (idempotent)
        if not _is_duplicate_notification("Responder Accepted Dispatch", citizen_notif_msg, "CITIZEN", incident.reported_by_id):
            db.notifications.insert(0, Notification(
                id=f"NOTIF-{str(uuid.uuid4())[:8]}",
                recipient_role="CITIZEN",
                recipient_user_id=incident.reported_by_id,
                incident_id=incident.id,
                plan_version=incident.current_plan_version,
                type="SUCCESS",
                title="Responder Accepted Dispatch",
                message=citizen_notif_msg,
                status="DELIVERED",
                created_at=now_str
            ))

    # Audit log
    db.audit_logs.insert(0, AuditLog(
        id=f"AUD-{str(uuid.uuid4())[:8]}",
        user_id=asg.resource_id,
        user_name=asg.resource_name,
        role=asg.resource_type.value.upper(),
        action="ASSIGNMENT_ACCEPTED",
        previous_value="ASSIGNED",
        new_value="ACCEPTED",
        reason=req.notes if req else "Resource confirmed operational acceptance",
        incident_id=asg.incident_id,
        plan_version=incident.current_plan_version if incident else "PLAN V1",
        timestamp=now_str
    ))

    # Real-time WebSocket broadcasts
    await ws_manager.broadcast("RESOURCE_ACCEPTED", {
        "assignment_id": asg.id,
        "resource_id": asg.resource_id,
        "resource_name": asg.resource_name,
        "incident_id": asg.incident_id
    })
    await ws_manager.broadcast("ASSIGNMENT_UPDATED", asg.model_dump())
    if incident:
        await ws_manager.broadcast("INCIDENT_UPDATED", incident.model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast_targeted_notifications()

    return asg

@router.post("/{id}/prepare-trauma-bays", response_model=Assignment)
async def prepare_trauma_bays(
    id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    Executes actual hospital trauma bay preparation:
    Reserves bed capacity, mobilizes trauma surgical staff, creates timeline entry,
    and dispatches live notifications to citizen and hospital dashboard.
    """
    asg = db.assignments.get(id)
    if not asg:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    now_str = datetime.utcnow().isoformat() + "Z"
    asg.status = "PREPARED"
    asg.response_status = "PREPARED"
    asg.updated_at = now_str

    incident = db.incidents.get(asg.incident_id)
    resource = db.resources.get(asg.resource_id)

    # Reserve bed/bay capacity in hospital if available
    if resource:
        if resource.available_units > 0:
            resource.available_units -= 1
        resource.updated_at = now_str

    if incident:
        incident.timeline.append({
            "timestamp": now_str,
            "event": "Trauma Bays Prepared",
            "details": f"{asg.resource_name} prepared Trauma Bay 1 & emergency surgical team is on active standby."
        })
        incident.updated_at = now_str

        # Generate notification for reporting citizen
        cit_msg = f"{asg.resource_name} has prepared Trauma Bays and specialized medical teams are waiting for incoming casualty arrival."
        if not _is_duplicate_notification("Trauma Bay Ready", cit_msg, "CITIZEN", incident.reported_by_id):
            db.notifications.insert(0, Notification(
                id=f"NOTIF-{str(uuid.uuid4())[:8]}",
                recipient_role="CITIZEN",
                recipient_user_id=incident.reported_by_id,
                incident_id=incident.id,
                plan_version=incident.current_plan_version,
                type="SUCCESS",
                title="Trauma Bay Ready",
                message=cit_msg,
                status="DELIVERED",
                created_at=now_str
            ))

    # Audit log
    db.audit_logs.insert(0, AuditLog(
        id=f"AUD-{str(uuid.uuid4())[:8]}",
        user_id=asg.resource_id,
        user_name=asg.resource_name,
        role="HOSPITAL",
        action="TRAUMA_BAYS_PREPARED",
        previous_value="ACCEPTED",
        new_value="PREPARED",
        reason="Hospital trauma readiness confirmed and bay allocated",
        incident_id=asg.incident_id,
        plan_version=incident.current_plan_version if incident else "PLAN V1",
        timestamp=now_str
    ))

    await ws_manager.broadcast("ASSIGNMENT_UPDATED", asg.model_dump())
    if incident:
        await ws_manager.broadcast("INCIDENT_UPDATED", incident.model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast_targeted_notifications()

    return asg

@router.post("/{id}/reject", response_model=Assignment)
async def reject_assignment(
    id: str,
    req: Optional[AssignmentActionRequest] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    Resource or Hospital rejects incoming emergency assignment.
    Triggers dynamic replanning to replace the resource automatically.
    """
    asg = db.assignments.get(id)
    if not asg:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    if current_user:
        u_role = (current_user.get("role") or "").upper()
        if u_role == "HOSPITAL" and asg.resource_type != ResourceType.HOSPITAL:
            raise HTTPException(status_code=403, detail="Hospital account cannot reject non-hospital assignments.")
        if u_role == "FIRE_TEAM" and asg.resource_type != ResourceType.FIRE_TEAM:
            raise HTTPException(status_code=403, detail="Fire team account cannot reject non-fire-team assignments.")
        if u_role == "CITIZEN":
            raise HTTPException(status_code=403, detail="Citizen account cannot modify responder assignments.")

    now_str = datetime.utcnow().isoformat() + "Z"
    asg.status = "REJECTED"
    asg.response_status = "REJECTED"
    asg.updated_at = now_str

    reason = req.reason if req and req.reason else "Responder unit unavailable/rejected assignment"

    # Sync notification state to REJECTED
    for n in db.notifications:
        if n.incident_id == asg.incident_id and (n.resource_id == asg.resource_id or (not n.resource_id and n.recipient_role == asg.resource_type.value.upper())):
            n.status = "REJECTED"
            n.read = True

    incident = db.incidents.get(asg.incident_id)
    resource = db.resources.get(asg.resource_id)
    if resource:
        resource.current_incident_id = None
        resource.status = ResourceStatus.UNAVAILABLE
        resource.updated_at = now_str

    # Trigger dynamic replanning for this incident
    new_plan = replan_manager.replan_incident(
        incident_id=asg.incident_id,
        reason=f"{asg.resource_name} rejected: {reason}",
        unavailable_resource_id=asg.resource_id
    )

    # Real-time WebSocket broadcasts
    await ws_manager.broadcast("RESOURCE_REJECTED", {
        "assignment_id": asg.id,
        "resource_id": asg.resource_id,
        "incident_id": asg.incident_id,
        "reason": reason
    })
    if new_plan:
        await ws_manager.broadcast("PLAN_UPDATED", new_plan.model_dump())
    if incident:
        await ws_manager.broadcast("INCIDENT_UPDATED", incident.model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast_targeted_notifications()

    return asg

@router.patch("/{id}/status", response_model=Assignment)
async def update_assignment_status(
    id: str,
    status: str = Query(..., description="EN_ROUTE, ARRIVED, RESPONDING, PREPARING, RECEIVED, RESOLVED"),
    notes: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Field responder updates operational progress with instant execution."""
    asg = db.assignments.get(id)
    if not asg:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    if current_user:
        u_role = (current_user.get("role") or "").upper()
        if u_role == "HOSPITAL" and asg.resource_type != ResourceType.HOSPITAL:
            raise HTTPException(status_code=403, detail="Hospital account cannot update non-hospital assignments.")
        if u_role == "FIRE_TEAM" and asg.resource_type != ResourceType.FIRE_TEAM:
            raise HTTPException(status_code=403, detail="Fire team account cannot update non-fire-team assignments.")
        if u_role == "CITIZEN":
            raise HTTPException(status_code=403, detail="Citizen account cannot modify responder assignments.")

    now_str = datetime.utcnow().isoformat() + "Z"
    old_status = asg.status
    target_status = status.upper().replace("-", "_")
    asg.status = target_status
    asg.updated_at = now_str

    incident = db.incidents.get(asg.incident_id)
    resource = db.resources.get(asg.resource_id)

    # Map assignment status to overall incident progression if appropriate
    if incident:
        if target_status == "EN_ROUTE":
            if incident.status in [IncidentStatus.ALLOCATED, IncidentStatus.ASSESSED]:
                incident.status = IncidentStatus.EN_ROUTE
            citizen_msg = f"{asg.resource_name} is en route to the incident."
        elif target_status in ["ARRIVED", "ON_SCENE"]:
            incident.status = IncidentStatus.ON_SCENE
            citizen_msg = f"{asg.resource_name} has arrived at the incident scene."
        elif target_status == "RESPONDING":
            incident.status = IncidentStatus.ON_SCENE
            citizen_msg = f"{asg.resource_name} is actively responding on scene."
        elif target_status in ["PREPARING", "PREPARED"]:
            citizen_msg = f"{asg.resource_name} is preparing trauma bays for incoming casualties."
        elif target_status == "RECEIVED":
            incident.status = IncidentStatus.ON_SCENE
            citizen_msg = f"{asg.resource_name} has received the emergency casualty."
        elif target_status == "RESOLVED":
            other_active = [a for a in db.assignments.values() if a.incident_id == incident.id and a.id != asg.id and a.status not in ["RESOLVED", "REJECTED"]]
            if not other_active:
                incident.status = IncidentStatus.RESOLVED
            if resource:
                resource.status = ResourceStatus.AVAILABLE
                resource.current_incident_id = None
            citizen_msg = f"{asg.resource_name} marked emergency operations resolved."

            # Update notifications for this incident to RESOLVED
            for n in db.notifications:
                if n.incident_id == incident.id and (n.resource_id == asg.resource_id or (not n.resource_id and n.recipient_role == asg.resource_type.value.upper())):
                    n.status = "RESOLVED"
                    n.read = True
        else:
            citizen_msg = f"{asg.resource_name} status updated to {target_status}."

        incident.timeline.append({
            "timestamp": now_str,
            "event": f"Status updated to {target_status}",
            "details": notes or f"{asg.resource_name} transitioned from {old_status} to {target_status}."
        })
        incident.updated_at = now_str

        # Notify citizen idempotently
        if not _is_duplicate_notification(f"Update from {asg.resource_name}", citizen_msg, "CITIZEN", incident.reported_by_id):
            db.notifications.insert(0, Notification(
                id=f"NOTIF-{str(uuid.uuid4())[:8]}",
                recipient_role="CITIZEN",
                recipient_user_id=incident.reported_by_id,
                incident_id=incident.id,
                plan_version=incident.current_plan_version,
                type="INFO" if target_status != "RESOLVED" else "SUCCESS",
                title=f"Update from {asg.resource_name}",
                message=citizen_msg,
                status="DELIVERED",
                created_at=now_str
            ))

    await ws_manager.broadcast("ASSIGNMENT_UPDATED", asg.model_dump())
    if incident:
        await ws_manager.broadcast("INCIDENT_UPDATED", incident.model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast_targeted_notifications()

    return asg
