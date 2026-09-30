import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.core.database import db
from app.models.schemas import (
    Incident, Resource, ResponsePlan, Assignment, ResourceStatus,
    ResourceType, IncidentSeverity, IncidentStatus, Notification, AuditLog
)
from app.agents.incident_agent import assess_general_incident
from app.agents.resource_agent import ResourceAllocationAgent
from app.agents.command_agent import CommandPlanningAgent

class ReplanningManager:
    """
    Dynamic Autonomous Replanning Engine:
    Detects operational changes, synthesizes new Plan versions (Plan V2, Plan V3, etc.),
    executes immediately, and records transparent rationale.
    """

    def __init__(self):
        self.resource_agent = ResourceAllocationAgent()
        self.command_agent = CommandPlanningAgent()

    def replan_incident(
        self,
        incident_id: str,
        reason: str,
        escalate_severity: Optional[IncidentSeverity] = None,
        unavailable_resource_id: Optional[str] = None
    ) -> Optional[ResponsePlan]:
        incident = db.incidents.get(incident_id)
        if not incident:
            return None

        now_str = datetime.utcnow().isoformat() + "Z"
        current_version_str = incident.current_plan_version or "PLAN V1"
        # Determine next version (e.g., PLAN V1 -> PLAN V2)
        try:
            curr_num = int(current_version_str.replace("PLAN V", "").strip())
            next_version = f"PLAN V{curr_num + 1}"
        except Exception:
            next_version = "PLAN V2"

        # If severity changed
        if escalate_severity:
            incident.severity = escalate_severity
            if incident.assessment:
                incident.assessment.severity = escalate_severity

        # If resource became unavailable
        if unavailable_resource_id and unavailable_resource_id in db.resources:
            db.resources[unavailable_resource_id].status = ResourceStatus.UNAVAILABLE
            db.resources[unavailable_resource_id].current_incident_id = None

        # Supersede old active plans
        for p in incident.plans:
            if p.status == "ACTIVE":
                p.status = "SUPERSEDED"

        # Re-run assessment if escalated or missing
        if not incident.assessment or escalate_severity:
            incident.assessment = assess_general_incident(
                incident_type=incident.incident_type,
                description=incident.description + (" [ESCALATED]" if escalate_severity else ""),
                people_affected=incident.people_affected,
                source_type=incident.source_type,
                source_confidence=incident.source_confidence
            )

        # Allocate new resources
        all_resources = list(db.resources.values())
        exclude_ids = [unavailable_resource_id] if unavailable_resource_id else []

        allocation_result = self.resource_agent.allocate(
            candidate_resources=all_resources,
            latitude=incident.latitude,
            longitude=incident.longitude,
            assessment=incident.assessment,
            exclude_resource_ids=exclude_ids
        )

        why_reasons = [
            f"Replanning trigger: {reason}",
            f"Previous configuration superseded to maintain critical response SLA",
            f"Assigned {len(allocation_result['allocated_items'])} updated assets"
        ]
        if unavailable_resource_id:
            res_obj = db.resources.get(unavailable_resource_id)
            res_name = res_obj.name if res_obj else "Unit"
            why_reasons.append(f"Compensated for failure of {res_name} by rerouting closest backup asset")

        new_plan = self.command_agent.create_plan(
            incident=incident,
            allocations=allocation_result["allocated_items"],
            alternatives=allocation_result["alternatives"],
            version=next_version,
            change_reason=reason,
            why_plan_changed=why_reasons
        )

        # Save new plan and update incident
        db.response_plans[new_plan.id] = new_plan
        incident.plans.append(new_plan)
        incident.current_plan_id = new_plan.id
        incident.current_plan_version = next_version
        incident.status = IncidentStatus.ALLOCATED
        incident.updated_at = now_str

        # Update resource statuses to DISPATCHED
        for asg in new_plan.assignments:
            db.assignments[asg.id] = asg
            if asg.resource_id in db.resources:
                db.resources[asg.resource_id].status = ResourceStatus.DISPATCHED
                db.resources[asg.resource_id].current_incident_id = incident.id

        # Append timeline entry
        incident.timeline.append({
            "timestamp": now_str,
            "event": f"Autonomous Replanning -> {next_version} Activated",
            "details": f"{reason}. Dispatched units: {', '.join([a.resource_name for a in new_plan.assignments])}"
        })

        # Add Notification
        db.notifications.insert(0, Notification(
            id=f"NOTIF-{str(uuid.uuid4())[:8]}",
            recipient_role="ALL",
            title=f"Dynamic Replanning: {next_version} for {incident.title}",
            message=f"{reason}. {next_version} automatically activated with zero downtime.",
            incident_id=incident.id,
            plan_version=next_version,
            type="ALERT",
            created_at=now_str
        ))

        # Add Audit Log
        db.audit_logs.insert(0, AuditLog(
            id=f"AUD-{str(uuid.uuid4())[:8]}",
            user_id="REPLAN_ENGINE",
            user_name="Autonomous Replanning Agent",
            role="SYSTEM",
            action="PLAN_UPDATED",
            previous_value=current_version_str,
            new_value=next_version,
            reason=reason,
            plan_version=next_version,
            incident_id=incident.id,
            timestamp=now_str
        ))

        return new_plan

replanning_manager = ReplanningManager()
