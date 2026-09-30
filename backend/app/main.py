import logging
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.services.websocket_manager import ws_manager

# Import API Routers
from app.api.routes_auth import router as auth_router
from app.api.routes_incidents import router as incidents_router
from app.api.routes_resources import router as resources_router
from app.api.routes_plans import router as plans_router
from app.api.routes_replanning import router as replanning_router
from app.api.routes_notifications import router as notifications_router
from app.api.routes_share import router as share_router
from app.api.routes_analytics import router as analytics_router
from app.api.routes_override import router as override_router
from app.api.routes_demo import router as demo_router
from app.api.routes_geo import router as geo_router
from app.api.routes_assignments import router as assignments_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CrisisCommand")

app = FastAPI(
    title="Crisis Command - Emergency Response API",
    description="Multi-Agent Emergency Response & Autonomous Resource Coordination System for GATEWAYS 2026",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(incidents_router)
app.include_router(resources_router)
app.include_router(assignments_router)
app.include_router(plans_router)
app.include_router(replanning_router)
app.include_router(notifications_router)
app.include_router(share_router)
app.include_router(analytics_router)
app.include_router(override_router)
app.include_router(demo_router)
app.include_router(geo_router)

# WebSocket Endpoints
@app.websocket("/ws")
@app.websocket("/ws/command")
async def websocket_command_endpoint(websocket: WebSocket, token: Optional[str] = None):
    await ws_manager.connect(websocket, token=token)
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                import json
                msg = json.loads(raw_text)
                if isinstance(msg, dict):
                    msg_type = msg.get("type") or msg.get("event")
                    if msg_type == "AUTH" and msg.get("token"):
                        ws_manager.authenticate_socket(websocket, msg["token"])
                        await websocket.send_text(json.dumps({"event": "AUTH_OK", "status": "authenticated"}))
                    elif msg_type == "PING":
                        await websocket.send_text(json.dumps({"event": "PONG", "timestamp": msg.get("timestamp")}))
                    else:
                        await websocket.send_text(json.dumps({"event": "ACK", "received": msg_type}))
            except Exception:
                await websocket.send_text('{"event": "PONG"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

@app.websocket("/ws/incidents")
async def websocket_incidents_endpoint(websocket: WebSocket):
    await websocket_command_endpoint(websocket)

@app.websocket("/ws/resources")
async def websocket_resources_endpoint(websocket: WebSocket):
    await websocket_command_endpoint(websocket)

@app.websocket("/ws/notifications")
async def websocket_notifications_endpoint(websocket: WebSocket):
    await websocket_command_endpoint(websocket)

@app.get("/")
def root():
    return {
        "system": "Crisis Command API",
        "tagline": "Multi-Agent Emergency Response & Resource Coordination System",
        "hackathon": "GATEWAYS 2026",
        "status": "ONLINE",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {"status": "healthy", "service": "Crisis Command Backend"}
