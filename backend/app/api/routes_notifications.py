from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from app.models.schemas import Notification
from app.core.database import db
from app.core.security import get_current_user
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[Notification])
def get_notifications(
    role: Optional[str] = None,
    user_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    incident_id: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    Retrieve targeted notifications for the authenticated user and role.
    Prevents leaking internal logs to citizens or cross-station responder leaks.
    Always returns newest notifications first.
    """
    effective_role = role
    effective_user_id = user_id
    effective_resource_id = resource_id

    # If authenticated, enforce identity from trusted JWT session
    if current_user:
        u_role = (current_user.get("role") or "").upper()
        u_id = current_user.get("id")
        meta = current_user.get("metadata") or {}
        res_id = meta.get("hospital_id") or meta.get("station_id") or meta.get("resource_id")

        if u_role not in ["ADMIN", "COMMANDER", "DISPATCHER"]:
            effective_role = u_role
            effective_user_id = u_id
            effective_resource_id = res_id

    notifs = list(db.notifications)

    if effective_role == "CITIZEN" or (effective_user_id and not effective_role):
        allowed_users = {effective_user_id} if effective_user_id else set()
        if effective_user_id in ["usr_citizen_demo", "usr_citizen_1"]:
            allowed_users.update(["usr_citizen_demo", "usr_citizen_1"])
        notifs = [
            n for n in notifs
            if (n.recipient_user_id and n.recipient_user_id in allowed_users)
            or (not n.recipient_user_id and n.recipient_role in ["ALL", "CITIZEN"])
        ]
    elif effective_role in ["HOSPITAL", "FIRE_TEAM"]:
        notifs = [
            n for n in notifs
            if (effective_resource_id and n.resource_id == effective_resource_id)
            or (not n.resource_id and n.recipient_role in ["ALL", effective_role])
            or (not effective_resource_id and n.recipient_role in ["ALL", effective_role])
        ]
    elif effective_role and effective_role != "ALL":
        notifs = [
            n for n in notifs
            if (n.recipient_role in ["ALL", effective_role] and not n.recipient_user_id)
        ]

    if incident_id:
        notifs = [n for n in notifs if n.incident_id == incident_id]

    # Sort strictly newest first
    notifs.sort(key=lambda x: x.created_at, reverse=True)
    return notifs[:50]

@router.patch("/{id}/read", response_model=Notification)
async def mark_read(id: str):
    for n in db.notifications:
        if n.id == id:
            n.read = True
            n.status = "READ"
            await ws_manager.broadcast_targeted_notifications()
            return n
    raise HTTPException(status_code=404, detail="Notification not found.")

@router.post("/mark-all-read")
async def mark_all_read(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Marks all notifications for the current authenticated user/role as read."""
    count = 0
    u_role = (current_user.get("role") or "").upper() if current_user else None
    u_id = current_user.get("id") if current_user else None
    meta = current_user.get("metadata") or {} if current_user else {}
    res_id = meta.get("hospital_id") or meta.get("station_id") or meta.get("resource_id")

    for n in db.notifications:
        # Check if notification belongs to this caller
        belongs = False
        if not current_user or u_role in ["ADMIN", "COMMANDER"]:
            belongs = True
        elif u_role == "CITIZEN" and ((u_id and n.recipient_user_id == u_id) or (not n.recipient_user_id and n.recipient_role in ["ALL", "CITIZEN"])):
            belongs = True
        elif u_role in ["HOSPITAL", "FIRE_TEAM"] and ((res_id and n.resource_id == res_id) or (not n.resource_id and n.recipient_role in ["ALL", u_role])):
            belongs = True

        if belongs and not n.read:
            n.read = True
            n.status = "READ"
            count += 1

    await ws_manager.broadcast_targeted_notifications()
    return {"status": "success", "marked_read_count": count}

@router.patch("/{id}/status", response_model=Notification)
async def update_notification_status(id: str, status: str = Query(..., description="PENDING, DELIVERED, READ, ACCEPTED, REJECTED, EXPIRED")):
    for n in db.notifications:
        if n.id == id:
            n.status = status.upper()
            if n.status == "READ":
                n.read = True
            await ws_manager.broadcast_targeted_notifications()
            return n
    raise HTTPException(status_code=404, detail="Notification not found.")
