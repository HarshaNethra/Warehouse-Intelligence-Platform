import json
from typing import List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

class TelemetryConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, Optional[str]] = {}

    async def connect(self, websocket: WebSocket, facility_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections[websocket] = facility_id
        print(f"[WebSocketManager] Client connected (Facility: {facility_id}). Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            print(f"[WebSocketManager] Client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast_telemetry(self, data: dict, facility_id: Optional[str] = None):
        """
        Broadcasts frame-by-frame inference metrics to connected UI dashboards, filtered by facility.
        """
        if not self.active_connections:
            return

        message = json.dumps(data)
        stale_connections = []
        for connection, client_facility_id in list(self.active_connections.items()):
            if facility_id and client_facility_id and client_facility_id != facility_id:
                continue
            try:
                await connection.send_text(message)
            except Exception:
                stale_connections.append(connection)

        for sc in stale_connections:
            self.disconnect(sc)

ws_manager = TelemetryConnectionManager()
ws_router = APIRouter()

@ws_router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(
    websocket: WebSocket,
    facility_id: Optional[str] = Query(None)
):
    await ws_manager.connect(websocket, facility_id=facility_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                if payload.get("action") == "PING":
                    await websocket.send_text(json.dumps({"status": "PONG", "timestamp": payload.get("timestamp")}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocketManager] Exception in websocket endpoint: {e}")
        ws_manager.disconnect(websocket)
