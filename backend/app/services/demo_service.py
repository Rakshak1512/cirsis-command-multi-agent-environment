import random
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from app.core.database import db, BASE_LAT, BASE_LNG
from app.models.schemas import (
    IncidentType, IncidentSeverity, IncidentUrgency, IncidentStatus,
    ResourceStatus, ResourceType, IncidentCreateRequest, Notification, AuditLog
)
from app.agents.graph import multi_agent_coordinator
from app.agents.replanning_agent import replanning_manager
from app.services.websocket_manager import ws_manager

class DemoSimulationService:
    """Powers the interactive hackathon demonstration scenarios."""

    async def simulate_fire(self, severity: IncidentSeverity = IncidentSeverity.HIGH) -> Dict[str, Any]:
        """Simulates a new fire incident and triggers automatic multi-agent execution."""
        offset_lat = random.uniform(-0.02, 0.02)
        offset_lng = random.uniform(-0.02, 0.02)
        req = IncidentCreateRequest(
            incident_type=IncidentType.FIRE,
            description="Flames reported emerging from 2nd story structure. Evacuation in progress, smoke spreading to adjacent roof.",
            people_affected=random.randint(4, 9),
            latitude=BASE_LAT + offset_lat,
            longitude=BASE_LNG + offset_lng,
            address=f"Commercial District Sector {random.randint(10, 99)} Plaza",
            source_type="citizen_report",
            source_confidence=0.96
        )
        incident = multi_agent_coordinator.process_new_incident(req)
        await ws_manager.broadcast("INCIDENT_CREATED", incident.model_dump())
        await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
        await ws_manager.broadcast("NOTIFICATIONS_UPDATED", [n.model_dump() for n in db.notifications[:10]])
        return {"status": "success", "incident": incident}

    async def simulate_road_accident(self, severity: IncidentSeverity = IncidentSeverity.HIGH) -> Dict[str, Any]:
        """Simulates a multi-vehicle highway accident."""
        offset_lat = random.uniform(-0.025, 0.025)
        offset_lng = random.uniform(-0.025, 0.025)
        req = IncidentCreateRequest(
            incident_type=IncidentType.ROAD_ACCIDENT,
            description="Two SUVs collided on highway overpass. Significant frontal deformation, occupants trapped, fluid spill.",
            people_affected=random.randint(3, 7),
            latitude=BASE_LAT + offset_lat,
            longitude=BASE_LNG + offset_lng,
            address=f"Outer Ring Highway Junction {random.randint(3, 18)}",
            source_type="cctv",
            source_confidence=0.98
        )
        incident = multi_agent_coordinator.process_new_incident(req)
        await ws_manager.broadcast("INCIDENT_CREATED", incident.model_dump())
        await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
        await ws_manager.broadcast("NOTIFICATIONS_UPDATED", [n.model_dump() for n in db.notifications[:10]])
        return {"status": "success", "incident": incident}

    async def escalate_fire(self, incident_id: str = "INC-001") -> Dict[str, Any]:
        """Escalates a fire incident (e.g. HIGH -> CRITICAL), automatically generating Plan V2."""
        incident = db.incidents.get(incident_id)
        if not incident:
            return {"status": "error", "message": f"Incident {incident_id} not found."}

        reason = "Fire jumped firewall to chemicals storage; toxic smoke hazard escalated to CRITICAL"
        new_plan = replanning_manager.replan_incident(
            incident_id=incident_id,
            reason=reason,
            escalate_severity=IncidentSeverity.CRITICAL
        )

        await ws_manager.broadcast("PLAN_UPDATED", new_plan.model_dump())
        await ws_manager.broadcast("INCIDENT_UPDATED", db.incidents[incident_id].model_dump())
        await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
        await ws_manager.broadcast("NOTIFICATIONS_UPDATED", [n.model_dump() for n in db.notifications[:10]])

        return {"status": "success", "new_plan": new_plan, "incident": db.incidents[incident_id]}

    async def make_ambulance_unavailable(self, resource_id: str = "RES-AMB-01") -> Dict[str, Any]:
        """Simulates an ambulance mechanical failure or blowout, triggering instant automatic replanning."""
        resource = db.resources.get(resource_id)
        if not resource:
            return {"status": "error", "message": f"Resource {resource_id} not found."}

        target_incident_id = resource.current_incident_id or "INC-001"
        resource.status = ResourceStatus.UNAVAILABLE
        resource.current_incident_id = None

        reason = f"{resource.name} suffered mechanical failure en-route. Automatic failover triggered."
        new_plan = replanning_manager.replan_incident(
            incident_id=target_incident_id,
            reason=reason,
            unavailable_resource_id=resource_id
        )

        await ws_manager.broadcast("RESOURCE_UNAVAILABLE", {"resource_id": resource_id})
        if new_plan:
            await ws_manager.broadcast("PLAN_UPDATED", new_plan.model_dump())
        await ws_manager.broadcast("INCIDENT_UPDATED", db.incidents[target_incident_id].model_dump())
        await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
        await ws_manager.broadcast("NOTIFICATIONS_UPDATED", [n.model_dump() for n in db.notifications[:10]])

        return {"status": "success", "resource_id": resource_id, "new_plan": new_plan}

    async def make_resource_available(self, resource_id: str) -> Dict[str, Any]:
        """Restores a resource to AVAILABLE status."""
        resource = db.resources.get(resource_id)
        if not resource:
            return {"status": "error", "message": "Resource not found"}

        resource.status = ResourceStatus.AVAILABLE
        resource.current_incident_id = None
        await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
        return {"status": "success", "resource": resource}

    async def resolve_incident(self, incident_id: str) -> Dict[str, Any]:
        """Marks an incident as RESOLVED and releases assigned units back to AVAILABLE."""
        incident = db.incidents.get(incident_id)
        if not incident:
            return {"status": "error", "message": "Incident not found"}

        now_str = datetime.utcnow().isoformat() + "Z"
        incident.status = IncidentStatus.RESOLVED
        incident.updated_at = now_str
        incident.timeline.append({
            "timestamp": now_str,
            "event": "Incident Resolved",
            "details": "All active fire suppression and medical evacuations successfully completed."
        })

        # Release resources
        for r in db.resources.values():
            if r.current_incident_id == incident_id:
                r.status = ResourceStatus.AVAILABLE
                r.current_incident_id = None

        # Add Notification
        db.notifications.insert(0, Notification(
            id=f"NOTIF-{str(uuid.uuid4())[:8]}",
            recipient_role="ALL",
            title=f"Incident Resolved: {incident.title}",
            message=f"Threat mitigated. Assigned resources returned to service.",
            incident_id=incident.id,
            plan_version=incident.current_plan_version,
            type="SUCCESS",
            created_at=now_str
        ))

        # Add Audit Log
        db.audit_logs.insert(0, AuditLog(
            id=f"AUD-{str(uuid.uuid4())[:8]}",
            user_id="FIELD_RESPONDER",
            user_name="Field Operations Team",
            role="FIRE_TEAM",
            action="INCIDENT_RESOLVED",
            previous_value="ALLOCATED",
            new_value="RESOLVED",
            reason="Scene secured and patients transferred.",
            plan_version=incident.current_plan_version,
            incident_id=incident.id,
            timestamp=now_str
        ))

        await ws_manager.broadcast("INCIDENT_UPDATED", incident.model_dump())
        await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
        await ws_manager.broadcast("NOTIFICATIONS_UPDATED", [n.model_dump() for n in db.notifications[:10]])

        return {"status": "success", "incident": incident}

    async def reset_demo(self) -> Dict[str, Any]:
        """Resets entire database back to initial pristine seed state."""
        db.reset()
        await ws_manager.broadcast("DEMO_RESET", {"status": "reset_complete"})
        return {"status": "success", "message": "Demo data reset successfully"}

demo_service = DemoSimulationService()
