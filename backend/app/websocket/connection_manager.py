from typing import List, Dict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Group active connections by office_id to prevent cross-office broadcasts
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, office_id: int):
        await websocket.accept()
        if office_id not in self.active_connections:
            self.active_connections[office_id] = []
        self.active_connections[office_id].append(websocket)

    def disconnect(self, websocket: WebSocket, office_id: int):
        if office_id in self.active_connections:
            if websocket in self.active_connections[office_id]:
                self.active_connections[office_id].remove(websocket)
            if not self.active_connections[office_id]:
                del self.active_connections[office_id]

    async def broadcast_to_office(self, office_id: int, message: dict):
        """
        Broadcast a JSON payload to all active websockets connected to a specific office.
        """
        if office_id in self.active_connections:
            for connection in self.active_connections[office_id][:]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Clean up inactive/broken sockets automatically
                    self.disconnect(connection, office_id)

manager = ConnectionManager()
