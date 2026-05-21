import asyncio
from asyncua import Client
from asyncua.common.node import Node
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class OPCUAManager:
    def __init__(self):
        self._clients: Dict[int, Client] = {}

    async def connect(self, connection_id: int, endpoint: str) -> bool:
        try:
            client = Client(url=endpoint, timeout=10)
            await client.connect()
            self._clients[connection_id] = client
            logger.info(f"Connected to {endpoint}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to {endpoint}: {e}")
            return False

    async def disconnect(self, connection_id: int) -> bool:
        client = self._clients.get(connection_id)
        if not client:
            return False
        try:
            await client.disconnect()
            del self._clients[connection_id]
            logger.info(f"Disconnected connection {connection_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to disconnect {connection_id}: {e}")
            return False

    def is_connected(self, connection_id: int) -> bool:
        return connection_id in self._clients

    def get_client(self, connection_id: int) -> Optional[Client]:
        return self._clients.get(connection_id)

opcua_manager = OPCUAManager()