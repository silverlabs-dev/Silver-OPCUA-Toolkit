# app/opcua/manager.py

import asyncio
from asyncua import Client
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class OPCUAManager:
    def __init__(self):
        self._clients: Dict[int, Client] = {}

    async def connect(self, connection_id: int, endpoint: str) -> bool:
        # If connection_id already exists, clean up before reconnecting
        if connection_id in self._clients:
            logger.warning(f"Connection {connection_id} already exists — cleaning up before reconnect")
            await self._force_cleanup(connection_id)

        client = Client(url=endpoint, timeout=10)
        try:
            await client.connect()
            self._clients[connection_id] = client
            logger.info(f"Connected to {endpoint} [id={connection_id}]")
            return True
        except Exception as e:
            # Connect failed — do not leave the client object dangling
            logger.error(f"Failed to connect to {endpoint} [id={connection_id}]: {e}")
            try:
                await client.disconnect()
            except Exception:
                pass  # Best effort — ignore secondary failure
            return False

    async def disconnect(self, connection_id: int) -> bool:
        if connection_id not in self._clients:
            logger.warning(f"Disconnect called for unknown connection {connection_id}")
            return False

        success = await self._force_cleanup(connection_id)
        if success:
            logger.info(f"Disconnected connection {connection_id}")
        return success

    async def _force_cleanup(self, connection_id: int) -> bool:
        """
        Always removes connection_id from the registry first,
        then attempts disconnect. Guarantees no memory leak
        even if disconnect() raises.
        """
        client = self._clients.pop(connection_id, None)
        if client is None:
            return False

        try:
            await client.disconnect()
            return True
        except Exception as e:
            # Client is already removed from registry — that is the important part.
            # Log the exception but still return True (registry is clean).
            logger.warning(
                f"Exception during disconnect of connection {connection_id} "
                f"(client already removed from registry): {e}"
            )
            return True

    def is_connected(self, connection_id: int) -> bool:
        """
        Checks both registry membership and actual connection state.
        """
        client = self._clients.get(connection_id)
        if client is None:
            return False

        # Check the underlying protocol object as the real connectivity signal
        try:
            return client.uaclient.protocol is not None
        except Exception:
            # If protocol access fails, treat connection as stale
            return False

    def get_client(self, connection_id: int) -> Optional[Client]:
        return self._clients.get(connection_id)

    async def disconnect_all(self) -> None:
        """
        Cleanly closes all active connections.
        Must be called on application shutdown.
        """
        if not self._clients:
            return

        connection_ids = list(self._clients.keys())
        logger.info(f"Shutting down {len(connection_ids)} OPC UA connection(s)...")

        results = await asyncio.gather(
            *[self._force_cleanup(cid) for cid in connection_ids],
            return_exceptions=True
        )

        failed = sum(1 for r in results if isinstance(r, Exception))
        if failed:
            logger.warning(f"disconnect_all: {failed}/{len(connection_ids)} cleanups had exceptions")
        else:
            logger.info("disconnect_all: all connections closed cleanly")


# Singleton instance
opcua_manager = OPCUAManager()