import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from fastapi import WebSocket

logger = logging.getLogger("CrisisCommandWS")

@dataclass
class ClientSession:
    websocket: WebSocket
    user_id: Optional[str] = None
    role: Optional[str] = None
    resource_id: Optional[str] = None

class WebSocketManager:
    """
    Manages authenticated real-time WebSocket connections with role-scoped event dispatch.
    Ensures events and notifications are routed only to authorized clients.
    """

    def __init__(self):
        self.sessions: Dict[WebSocket, ClientSession] = {}

    @property
    def active_connections(self) -> List[WebSocket]:
        return list(self.sessions.keys())

    def _extract_auth_from_token(self, token: str) -> Dict[str, Optional[str]]:
        try:
            from app.core.security import decode_access_token
            from app.core.database import db
            payload = decode_access_token(token)
            if not payload:
                return {}
            email = payload.get("email")
            user = db.users.get(email.strip().lower()) if email else None
            user_id = payload.get("sub") or (user["id"] if user else None)
            role = payload.get("role") or (user["role"] if user else None)
            resource_id = None
            if user and user.get("metadata"):
                meta = user["metadata"]
                resource_id = meta.get("hospital_id") or meta.get("station_id") or meta.get("resource_id")
            return {
                "user_id": user_id,
                "role": role.upper() if role else None,
                "resource_id": resource_id
            }
        except Exception as e:
            logger.warning(f"Error decoding WS token: {e}")
            return {}

    async def connect(self, websocket: WebSocket, token: Optional[str] = None):
        await websocket.accept()
        session = ClientSession(websocket=websocket)
        if token:
            auth_info = self._extract_auth_from_token(token)
            session.user_id = auth_info.get("user_id")
            session.role = auth_info.get("role")
            session.resource_id = auth_info.get("resource_id")
        self.sessions[websocket] = session
        logger.info(f"WebSocket client connected (role={session.role}, user={session.user_id}). Total: {len(self.sessions)}")

    def authenticate_socket(self, websocket: WebSocket, token: str):
        if websocket in self.sessions:
            auth_info = self._extract_auth_from_token(token)
            self.sessions[websocket].user_id = auth_info.get("user_id")
            self.sessions[websocket].role = auth_info.get("role")
            self.sessions[websocket].resource_id = auth_info.get("resource_id")
            logger.info(f"WebSocket authenticated socket (role={auth_info.get('role')}, user={auth_info.get('user_id')})")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.sessions:
            del self.sessions[websocket]
            logger.info(f"WebSocket client disconnected. Total remaining: {len(self.sessions)}")

    async def broadcast(self, event_type: str, data: Any):
        """Broadcasts general event JSON to all connected clients."""
        payload = json.dumps({
            "event": event_type,
            "data": data
        })
        disconnected = []
        for ws in list(self.sessions.keys()):
            try:
                await ws.send_text(payload)
            except Exception:
                disconnected.append(ws)

        for dead in disconnected:
            self.disconnect(dead)

    async def broadcast_targeted_notifications(self):
        """
        Sends tailored notification streams to each client based on their authenticated identity and role.
        Never leaks sensitive responder or other citizen notifications across boundaries.
        """
        from app.core.database import db
        all_notifs = db.notifications

        disconnected = []
        for ws, session in list(self.sessions.items()):
            try:
                role = (session.role or "").upper()
                user_id = session.user_id
                res_id = session.resource_id

                if role in ["ADMIN", "COMMANDER", "DISPATCHER"]:
                    # Commanders / Admins oversee all notifications
                    targeted = all_notifs[:25]
                elif role == "CITIZEN":
                    # Citizens only see notifications addressed to them or for their incidents
                    targeted = [
                        n for n in all_notifs
                        if n.recipient_user_id == user_id or n.recipient_role in ["ALL", "CITIZEN"]
                    ][:25]
                elif role == "HOSPITAL":
                    # Hospitals only see notifications for their hospital ID or general hospital broadcasts
                    targeted = [
                        n for n in all_notifs
                        if (res_id and n.resource_id == res_id) or n.recipient_role in ["ALL", "HOSPITAL"]
                    ][:25]
                elif role == "FIRE_TEAM":
                    # Fire teams only see notifications for their fire station or general fire team broadcasts
                    targeted = [
                        n for n in all_notifs
                        if (res_id and n.resource_id == res_id) or n.recipient_role in ["ALL", "FIRE_TEAM"]
                    ][:25]
                else:
                    targeted = [n for n in all_notifs if n.recipient_role == "ALL"][:15]

                payload = json.dumps({
                    "event": "NOTIFICATIONS_UPDATED",
                    "data": [n.model_dump() for n in targeted]
                })
                await ws.send_text(payload)
            except Exception:
                disconnected.append(ws)

        for dead in disconnected:
            self.disconnect(dead)

ws_manager = WebSocketManager()
