import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.models.schemas import ResponsePlan, Assignment, Incident, Resource

class CommandPlanningAgent:
    """Creates actionable emergency response plans with automated activation."""

    def create_plan(
        self,
        incident: Incident,
        allocations: List[Dict[str, Any]],
        alternatives: List[Dict[str, Any]],
        version: str = "PLAN V1",
        change_reason: str = "Autonomous multi-agent dispatch generation",
        why_plan_changed: Optional[List[str]] = None
    ) -> ResponsePlan:
        plan_id = "PLAN-" + str(uuid.uuid4())[:8]
        now_str = datetime.utcnow().isoformat() + "Z"

        assignments = []
        for item in allocations:
            res: Resource = item["resource"]
            asg_id = "ASG-" + str(uuid.uuid4())[:8]
            assignment = Assignment(
                id=asg_id,
                incident_id=incident.id,
                plan_id=plan_id,
                resource_id=res.id,
                resource_name=res.name,
                resource_type=res.type,
                status="DISPATCHED",
                eta_minutes=item["eta_minutes"],
                distance_km=item["distance_km"],
                route_summary=f"Rapid corridor to {incident.address} (ETA {item['eta_minutes']}m)",
                assigned_at=now_str,
                updated_at=now_str
            )
            assignments.append(assignment)

        reasons = why_plan_changed or [
            f"Autonomous match based on proximity and unit readiness",
            f"Severity evaluated as {incident.severity.value} ({incident.urgency.value} urgency)",
            f"{len(assignments)} critical emergency units dispatched simultaneously"
        ]

        return ResponsePlan(
            id=plan_id,
            incident_id=incident.id,
            version=version,
            status="ACTIVE",
            assignments=assignments,
            alternative_resources=alternatives,
            change_reason=change_reason,
            why_plan_changed=reasons,
            triggered_by="AUTOMATIC_MULTI_AGENT_ENGINE",
            created_at=now_str,
            activated_at=now_str
        )
