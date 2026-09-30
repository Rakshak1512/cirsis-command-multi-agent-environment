from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from app.models.schemas import Resource, ResourceType, ResourceStatus, ResourceLocationUpdateRequest
from app.core.database import db
from app.core.security import get_current_user
from app.services.websocket_manager import ws_manager
from app.services.routing_service import routing_service

router = APIRouter(prefix="/resources", tags=["Resources"])

@router.get("", response_model=List[Resource])
def get_resources(type: Optional[ResourceType] = None, status: Optional[ResourceStatus] = None):
    res_list = list(db.resources.values())
    if type:
        res_list = [r for r in res_list if r.type == type]
    if status:
        res_list = [r for r in res_list if r.status == status]
    return res_list

@router.get("/{id}", response_model=Resource)
def get_resource(id: str):
    res = db.resources.get(id)
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found.")
    return res

@router.post("", response_model=Resource)
async def create_resource(res: Resource):
    if res.id in db.resources:
        raise HTTPException(status_code=400, detail="Resource ID already exists.")
    db.resources[res.id] = res
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    return res

from pydantic import BaseModel

class CapacityUpdateRequest(BaseModel):
    available_units: Optional[int] = None
    capacity: Optional[int] = None
    icu_beds: Optional[int] = None
    trauma_bays: Optional[int] = None

@router.patch("/{id}", response_model=Resource)
async def update_resource_status(
    id: str,
    status: Optional[ResourceStatus] = None,
    available_units: Optional[int] = None
):
    resource = db.resources.get(id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    if status:
        resource.status = status
    if available_units is not None:
        if available_units < 0:
            raise HTTPException(status_code=400, detail="Available units cannot be negative.")
        if available_units > resource.capacity:
            raise HTTPException(status_code=400, detail=f"Available units ({available_units}) cannot exceed capacity ({resource.capacity}).")
        resource.available_units = available_units

    resource.updated_at = datetime.utcnow().isoformat() + "Z"
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    return resource

@router.patch("/{id}/capacity", response_model=Resource)
async def update_resource_capacity(
    id: str,
    req: CapacityUpdateRequest,
    current_user: Optional[dict] = Depends(get_current_user)
):
    resource = db.resources.get(id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    # Role-based authorization: hospital can only update their own facility
    if current_user:
        u_role = (current_user.get("role") or "").upper()
        if u_role == "HOSPITAL":
            meta = current_user.get("metadata") or {}
            hosp_id = meta.get("hospital_id") or meta.get("resource_id")
            if hosp_id and hosp_id != id:
                raise HTTPException(status_code=403, detail="Unauthorized to modify another medical facility's capacity.")

    if req.capacity is not None:
        if req.capacity < 0:
            raise HTTPException(status_code=400, detail="Total capacity cannot be negative.")
        resource.capacity = req.capacity

    if req.available_units is not None:
        if req.available_units < 0:
            raise HTTPException(status_code=400, detail="Available beds cannot be negative.")
        if req.available_units > resource.capacity:
            raise HTTPException(status_code=400, detail=f"Available beds ({req.available_units}) cannot exceed configured capacity ({resource.capacity}).")
        resource.available_units = req.available_units

    resource.updated_at = datetime.utcnow().isoformat() + "Z"
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    return resource

@router.post("/{id}/location", response_model=Resource)
async def update_resource_location(id: str, req: ResourceLocationUpdateRequest):
    """
    Part 19: Live responder location streaming.
    Receives live GPS updates from responder device, updates coordinates,
    recalculates distance and ETA for active emergency assignments, and broadcasts live telemetry.
    """
    resource = db.resources.get(id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    now_iso = datetime.utcnow().isoformat() + "Z"
    resource.latitude = req.latitude
    resource.longitude = req.longitude
    resource.accuracy = req.accuracy
    resource.heading = req.heading
    resource.speed = req.speed
    resource.last_location_update = now_iso
    resource.is_live_location = True
    resource.updated_at = now_iso

    # If this resource is assigned to an active incident, recalculate distance + ETA deterministically
    updated_assignments = []
    for asg in db.assignments.values():
        if asg.resource_id == id and asg.status not in ["RESOLVED", "REJECTED"]:
            incident = db.incidents.get(asg.incident_id)
            if incident and incident.status != "RESOLVED":
                new_dist = routing_service.calculate_distance(
                    resource.latitude, resource.longitude,
                    incident.latitude, incident.longitude
                )
                new_eta = routing_service.calculate_eta(new_dist, resource.type.value, is_emergency=True)
                asg.distance_km = new_dist
                asg.eta_minutes = new_eta
                asg.updated_at = now_iso
                updated_assignments.append(asg)

                # Broadcast ETA updated event
                await ws_manager.broadcast("ETA_UPDATED", {
                    "incident_id": incident.id,
                    "resource_id": id,
                    "distance_km": new_dist,
                    "eta_minutes": new_eta,
                    "timestamp": now_iso
                })

    # Broadcast live location update
    await ws_manager.broadcast("RESOURCE_LOCATION_UPDATED", {
        "resource_id": id,
        "resource_name": resource.name,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "accuracy": req.accuracy,
        "timestamp": now_iso,
        "is_live": True
    })
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])

    return resource

@router.post("/{id}/live-tracking")
async def toggle_live_tracking(id: str, enabled: bool = Query(...)):
    """Toggles responder live location telemetry stream."""
    resource = db.resources.get(id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    resource.is_live_location = enabled
    resource.updated_at = datetime.utcnow().isoformat() + "Z"
    await ws_manager.broadcast("RESOURCES_UPDATED", [r.model_dump() for r in db.resources.values()])
    return {"status": "success", "resource_id": id, "live_tracking": enabled}
