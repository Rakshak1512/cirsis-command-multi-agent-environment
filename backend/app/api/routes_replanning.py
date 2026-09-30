from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.schemas import ResponsePlan, IncidentSeverity
from app.agents.replanning_agent import replanning_manager
from app.core.database import db
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/replanning", tags=["Dynamic Replanning"])

class ReplanningTriggerRequest(BaseModel):
    incident_id: str
    reason: str
    escalate_severity: Optional[IncidentSeverity] = None
    unavailable_resource_id: Optional[str] = None

@router.post("/trigger", response_model=ResponsePlan)
async def trigger_replanning(req: ReplanningTriggerRequest):
    """
    CRITICAL USER REQUIREMENT:
    Immediately generates and activates updated plan version (PLAN V2/V3) with zero approval popups!
    """
    new_plan = replanning_manager.replan_incident(
        incident_id=req.incident_id,
        reason=req.reason,
        escalate_severity=req.escalate_severity,
        unavailable_resource_id=req.unavailable_resource_id
    )
    if not new_plan:
        raise HTTPException(status_code=404, detail="Incident not found for replanning.")

    # Broadcast real-time updates
    await ws_manager.broadcast("PLAN_UPDATED", new_plan.model_dump())
    await ws_manager.broadcast("INCIDENT_UPDATED", db.incidents[req.incident_id].model_dump())
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    await ws_manager.broadcast("NOTIFICATIONS_UPDATED", [n.model_dump() for n in db.notifications[:10]])

    return new_plan
