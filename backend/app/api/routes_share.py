from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.database import db
from app.core.config import settings

router = APIRouter(prefix="/share", tags=["Share & Alert"])

class ShareRequest(BaseModel):
    incident_id: str

@router.get("/incident/{incident_id}")
@router.post("/incident")
def get_shareable_incident_data(incident_id: Optional[str] = None, req: Optional[ShareRequest] = None):
    target_id = req.incident_id if req else incident_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Incident ID is required.")

    incident = db.incidents.get(target_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found.")

    # Find active assigned units & receiving hospital
    assigned_names = []
    hospital_name = "En-route allocation"
    eta_val = "4-6 mins"
    if incident.current_plan_id and incident.current_plan_id in db.response_plans:
        plan = db.response_plans[incident.current_plan_id]
        for a in plan.assignments:
            assigned_names.append(a.resource_name)
            if a.resource_type.value == "hospital":
                hospital_name = a.resource_name
            if a.eta_minutes:
                eta_val = f"{a.eta_minutes} mins"

    title = "Crisis Command Emergency Alert"
    assigned_str = ", ".join(assigned_names) if assigned_names else "Units Dispatched"
    plan_ver = incident.current_plan_version or "PLAN V1"
    secure_url = f"{settings.FRONTEND_URL}/citizen/incident/{incident.id}"
    map_url = f"https://www.openstreetmap.org/?mlat={incident.latitude}&mlon={incident.longitude}#map=16/{incident.latitude}/{incident.longitude}"

    formatted_text = (
        f"CRISIS COMMAND ALERT\n\n"
        f"Incident: {incident.incident_type.value.replace('_', ' ').upper()}\n"
        f"Severity: {incident.severity.value}\n"
        f"Location: {incident.address}\n"
        f"People affected: {incident.people_affected}\n"
        f"Assigned resources: {assigned_str}\n"
        f"Hospital: {hospital_name}\n"
        f"ETA: {eta_val}\n"
        f"Plan: {plan_ver}\n"
        f"Incident ID: {incident.id}\n\n"
        f"URL:\n{secure_url}"
    )

    return {
        "status": "success",
        "incident_id": incident.id,
        "title": title,
        "text": formatted_text,
        "url": secure_url,
        "map_url": map_url,
        "summary": {
            "type": incident.incident_type.value,
            "severity": incident.severity.value,
            "location": incident.address,
            "people_affected": incident.people_affected,
            "assigned_resources": assigned_str,
            "hospital": hospital_name,
            "eta": eta_val,
            "plan_version": plan_ver
        }
    }

@router.post("/whatsapp")
def share_via_whatsapp(req: ShareRequest):
    data = get_shareable_incident_data(req=req)
    incident = db.incidents.get(req.incident_id)
    from app.services.whatsapp_service import generate_whatsapp_share_url, format_whatsapp_alert_text
    whatsapp_url = generate_whatsapp_share_url(incident)
    formatted = format_whatsapp_alert_text(incident)
    return {
        "status": "success",
        "whatsapp_url": whatsapp_url,
        "formatted_text": formatted,
        "incident_id": incident.id
    }
