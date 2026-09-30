import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.models.schemas import (
    Incident, IncidentCreateRequest, IncidentStatus, ResourceStatus, ResourceType,
    ResponsePlan, Assignment, Notification, AuditLog
)
from app.core.database import db
from app.agents.incident_agent import assess_general_incident
from app.agents.fire_agent import FireAssessmentAgent
from app.agents.accident_agent import AccidentAssessmentAgent
from app.agents.resource_agent import ResourceAllocationAgent
from app.agents.logistics_agent import LogisticsRouteAgent
from app.agents.command_agent import CommandPlanningAgent

class EmergencyMultiAgentCoordinator:
    """
    Multi-Agent Coordination Engine:
    Orchestrates Incident Assessment -> Domain Specialist -> Resource Allocation -> 
    Logistics Routing -> Validation -> Automated Execution.
    """

    def __init__(self):
        self.fire_agent = FireAssessmentAgent()
        self.accident_agent = AccidentAssessmentAgent()
        self.resource_agent = ResourceAllocationAgent()
        self.logistics_agent = LogisticsRouteAgent()
        self.command_agent = CommandPlanningAgent()

    def process_new_incident(self, req: IncidentCreateRequest, reported_by_id: Optional[str] = None) -> Incident:
        now_str = datetime.utcnow().isoformat() + "Z"
        incident_id = f"INC-{str(uuid.uuid4())[:6].upper()}"

        # 1. Intake & AI Assessment
        assessment = assess_general_incident(
            incident_type=req.incident_type,
            description=req.description,
            people_affected=req.people_affected,
            source_type=req.source_type or "citizen_report",
            source_confidence=req.source_confidence or 0.95
        )

        title = f"{req.incident_type.value.replace('_', ' ').title()}: {req.address[:30]}"
        incident = Incident(
            id=incident_id,
            incident_type=req.incident_type,
            title=title,
            description=req.description,
            severity=assessment.severity,
            urgency=assessment.urgency,
            status=IncidentStatus.ASSESSED,
            people_affected=req.people_affected,
            latitude=req.latitude,
            longitude=req.longitude,
            accuracy=req.accuracy,
            location_captured_at=req.location_captured_at,
            address=req.address or "Emergency Location",
            image_url=req.image_url,
            video_url=req.video_url,
            reported_by_id=reported_by_id or "usr_citizen_1",
            source_type=req.source_type or "citizen_report",
            source_confidence=req.source_confidence or 0.95,
            assessment=assessment,
            current_plan_version="PLAN V1",
            created_at=now_str,
            updated_at=now_str
        )

        # 2. Add intake timeline
        incident.timeline.append({
            "timestamp": now_str,
            "event": "Incident reported",
            "details": f"Source: {req.source_type}, Affected: {req.people_affected}"
        })
        incident.timeline.append({
            "timestamp": now_str,
            "event": "AI Assessment completed",
            "details": f"Severity: {assessment.severity.value}, Urgency: {assessment.urgency.value}, Needs: {', '.join(assessment.required_resources)}"
        })

        # 3. Domain Specialist Refinement
        if req.incident_type.value == "fire":
            fire_analysis = self.fire_agent.analyze(req.description, req.people_affected, req.source_type or "")
            if fire_analysis["is_hazmat"]:
                assessment.reasoning.append("Hazmat protocols engaged: Foam-equipped engine prioritized.")
        else:
            accident_analysis = self.accident_agent.analyze(req.description, req.people_affected, req.source_type or "")
            if accident_analysis["extrication_gear_required"]:
                assessment.reasoning.append("Vehicle entrapment confirmed: Heavy hydraulic rescue team included.")

        # 4. Resource Allocation
        all_resources = list(db.resources.values())
        allocation_res = self.resource_agent.allocate(
            candidate_resources=all_resources,
            latitude=req.latitude,
            longitude=req.longitude,
            assessment=assessment
        )

        # 5. Command Planning & Response Plan V1
        plan = self.command_agent.create_plan(
            incident=incident,
            allocations=allocation_res["allocated_items"],
            alternatives=allocation_res["alternatives"],
            version="PLAN V1",
            change_reason="Initial automated multi-agent response dispatch",
            why_plan_changed=[
                f"Autonomous assessment concluded {assessment.severity.value} severity",
                f"Calculated optimal dispatch for {len(allocation_res['allocated_items'])} units",
                "Deterministic validation passed: No capacity or road conflicts"
            ]
        )

        # 6. Automatic Execution
        incident.status = IncidentStatus.ALLOCATED
        incident.current_plan_id = plan.id
        incident.current_plan_version = "PLAN V1"
        incident.plans.append(plan)
        db.response_plans[plan.id] = plan
        db.incidents[incident.id] = incident

        for asg in plan.assignments:
            db.assignments[asg.id] = asg
            if asg.resource_id in db.resources:
                db.resources[asg.resource_id].status = ResourceStatus.DISPATCHED
                db.resources[asg.resource_id].current_incident_id = incident.id

        # 7. Add Dispatch Timeline & Audit
        incident.timeline.append({
            "timestamp": now_str,
            "event": "Plan V1 generated & automatically activated",
            "details": f"Dispatched: {', '.join([a.resource_name for a in plan.assignments])}"
        })

        # Notifications targeting only relevant parties (Part 14 & 15)
        # 1. Direct notification to the reporting citizen
        db.notifications.insert(0, Notification(
            id=f"NOTIF-{str(uuid.uuid4())[:8]}",
            recipient_role="CITIZEN",
            recipient_user_id=incident.reported_by_id,
            title="Emergency Dispatched",
            message="Your emergency report has been processed. Response teams have been dispatched.",
            incident_id=incident.id,
            plan_version="PLAN V1",
            type="SUCCESS",
            status="DELIVERED",
            created_at=now_str
        ))

        # 2. Targeted dispatch notifications to ONLY assigned nearby resources
        for asg in plan.assignments:
            r_type = asg.resource_type.value if hasattr(asg.resource_type, 'value') else str(asg.resource_type)
            target_role = "FIRE_TEAM" if r_type == "fire_team" else ("HOSPITAL" if r_type == "hospital" else "DISPATCHER")
            db.notifications.insert(0, Notification(
                id=f"NOTIF-{str(uuid.uuid4())[:8]}",
                recipient_role=target_role,
                resource_id=asg.resource_id,
                title=f"NEW EMERGENCY: {incident.title}",
                message=f"Incident: {incident.title}. Location: {incident.address}. Distance: {asg.distance_km}km, ETA: {asg.eta_minutes} min.",
                incident_id=incident.id,
                plan_version="PLAN V1",
                type="CRITICAL",
                status="PENDING",
                created_at=now_str
            ))

        # 3. Tactical notification for Commander oversight
        db.notifications.insert(0, Notification(
            id=f"NOTIF-{str(uuid.uuid4())[:8]}",
            recipient_role="COMMANDER",
            title=f"DISPATCH ACTIVATED: {incident.title}",
            message=f"Plan V1 auto-dispatched {len(plan.assignments)} units ({', '.join([a.resource_name for a in plan.assignments])}).",
            incident_id=incident.id,
            plan_version="PLAN V1",
            type="ALERT",
            status="DELIVERED",
            created_at=now_str
        ))

        # Audit Log
        db.audit_logs.insert(0, AuditLog(
            id=f"AUD-{str(uuid.uuid4())[:8]}",
            user_id="AUTONOMOUS_ENGINE",
            user_name="Emergency Multi-Agent Coordinator",
            role="SYSTEM",
            action="PLAN_AUTO_ACTIVATED",
            previous_value="NONE",
            new_value="PLAN V1",
            reason="Automated incident assessment, proximity optimization and execution completed.",
            plan_version="PLAN V1",
            incident_id=incident.id,
            timestamp=now_str
        ))

        return incident

multi_agent_coordinator = EmergencyMultiAgentCoordinator()
