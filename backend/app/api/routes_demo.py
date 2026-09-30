from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.demo_service import demo_service
from app.models.schemas import IncidentSeverity

router = APIRouter(prefix="/demo", tags=["Demo Simulation"])

class EscalateFireRequest(BaseModel):
    incident_id: Optional[str] = "INC-001"

class UnavailableAmbulanceRequest(BaseModel):
    resource_id: Optional[str] = "RES-AMB-01"

class ResourceAvailableRequest(BaseModel):
    resource_id: str

class ResolveIncidentRequest(BaseModel):
    incident_id: str

@router.post("/simulate-fire")
async def simulate_fire():
    return await demo_service.simulate_fire()

@router.post("/simulate-accident")
async def simulate_accident():
    return await demo_service.simulate_road_accident()

@router.post("/escalate-fire")
async def escalate_fire(req: EscalateFireRequest):
    return await demo_service.escalate_fire(incident_id=req.incident_id or "INC-001")

@router.post("/ambulance-unavailable")
async def ambulance_unavailable(req: UnavailableAmbulanceRequest):
    return await demo_service.make_ambulance_unavailable(resource_id=req.resource_id or "RES-AMB-01")

@router.post("/resource-available")
async def resource_available(req: ResourceAvailableRequest):
    return await demo_service.make_resource_available(resource_id=req.resource_id)

@router.post("/resolve-incident")
async def resolve_incident(req: ResolveIncidentRequest):
    return await demo_service.resolve_incident(incident_id=req.incident_id)

@router.post("/reset")
async def reset_demo():
    return await demo_service.reset_demo()
