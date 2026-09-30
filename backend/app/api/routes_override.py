import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.models.schemas import CommanderOverrideRequest, AuditLog, Notification, ResourceStatus
from app.core.database import db
from app.agents.replanning_agent import replanning_manager
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/commander", tags=["Commander Overrides"])

@router.post("/override")
async def commander_override(req: CommanderOverrideRequest):
    """
    CRITICAL USER REQUIREMENT:
    Commander manual override executes immediately without blocking approval modals.
    Records full audit trail with Who, What, When, Why.
    """
    incident = db.incidents.get(req.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")

    now_str = datetime.utcnow().isoformat() + "Z"
    action_type = req.action_type.upper()
    prev_val = ""
    new_val = ""

    if action_type == "CHANGE_SEVERITY" and req.new_severity:
        prev_val = incident.severity.value
        new_val = req.new_severity.value
        incident.severity = req.new_severity
        if incident.assessment:
            incident.assessment.severity = req.new_severity

    elif action_type == "MARK_UNAVAILABLE" and req.resource_id:
        res = db.resources.get(req.resource_id)
        if res:
            prev_val = res.status.value
            new_val = ResourceStatus.UNAVAILABLE.value
            res.status = ResourceStatus.UNAVAILABLE
            res.current_incident_id = None

    elif action_type == "TRIGGER_REPLAN":
        prev_val = incident.current_plan_version or "PLAN V1"
        new_plan = replanning_manager.replan_incident(
            incident_id=req.incident_id,
            reason=f"Commander Manual Override: {req.reason}"
        )
        new_val = new_plan.version if new_plan else "REPLANNED"

    # Save Audit Log
    audit_entry = AuditLog(
        id=f"AUD-{str(uuid.uuid4())[:8]}",
        user_id="usr_commander_1",
        user_name="Chief Commander Marcus Vance",
        role="COMMANDER",
        action=f"COMMANDER_OVERRIDE_{action_type}",
        previous_value=prev_val,
        new_value=new_val,
        reason=req.reason,
        plan_version=incident.current_plan_version,
        incident_id=incident.id,
        timestamp=now_str
    )
    db.audit_logs.insert(0, audit_entry)

    # Save Notification
    db.notifications.insert(0, Notification(
        id=f"NOTIF-{str(uuid.uuid4())[:8]}",
        recipient_role="ALL",
        title=f"Commander Override: {action_type}",
        message=f"{req.reason} (Executed immediately)",
        incident_id=incident.id,
        plan_version=incident.current_plan_version,
        type="ALERT",
        created_at=now_str
    ))

    # Real-time WebSocket Broadcast
    await ws_manager.broadcast("COMMANDER_OVERRIDE", {
        "incident_id": incident.id,
        "action": action_type,
        "audit": audit_entry.model_dump()
    })
    await ws_manager.broadcast("INCIDENT_UPDATED", incident.model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast("NOTIFICATIONS_UPDATED", [n.model_dump() for n in db.notifications[:10]])

    return {
        "status": "success",
        "action": action_type,
        "incident_id": incident.id,
        "reason": req.reason,
        "timestamp": now_str
    }

@router.get("/audit-logs")
def get_audit_logs():
    return db.audit_logs[:50]
