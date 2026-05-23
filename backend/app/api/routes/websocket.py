# backend/app/api/routes/websocket.py

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.opcua.manager import opcua_manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Default intervals — can be overridden per connection via handshake
DEFAULT_MONITOR_INTERVAL = 1.0
MIN_MONITOR_INTERVAL     = 0.1   # 100ms
MAX_MONITOR_INTERVAL     = 10.0  # 10s

# Dead connection detection
PING_INTERVAL_SECONDS    = 5.0

# How long to wait for the initial handshake message
HANDSHAKE_TIMEOUT_SECONDS = 10.0


@router.websocket("/ws/{connection_id}/monitor")
async def monitor_tags(websocket: WebSocket, connection_id: int):
    """
    WebSocket endpoint for real-time tag monitoring.
    Accepts a list of node_ids and optional update_rate_ms from the client,
    then streams their current values until the client disconnects.
    """
    await websocket.accept()
    logger.info(f"WebSocket opened [connection_id={connection_id}]")

    # Verify OPC UA client exists
    client = opcua_manager.get_client(connection_id)
    if not client:
        logger.warning(f"WebSocket rejected — OPC UA connection {connection_id} is not active")
        await websocket.send_json({"error": "OPC UA connection is not active."})
        await websocket.close()
        return

    # Wait for handshake with timeout
    try:
        data = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=HANDSHAKE_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        logger.warning(f"WebSocket handshake timeout [connection_id={connection_id}]")
        await websocket.send_json({"error": "Timed out waiting for node_ids."})
        await websocket.close()
        return
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected during handshake [connection_id={connection_id}]")
        return

    node_ids = data.get("node_ids", [])
    if not node_ids:
        await websocket.send_json({"error": "No node_ids provided."})
        await websocket.close()
        return

    # Read optional update_rate_ms from handshake — clamp to safe range
    update_rate_ms = data.get("update_rate_ms", DEFAULT_MONITOR_INTERVAL * 1000)
    monitor_interval = update_rate_ms / 1000.0
    monitor_interval = max(MIN_MONITOR_INTERVAL, min(MAX_MONITOR_INTERVAL, monitor_interval))

    nodes = [client.get_node(nid) for nid in node_ids]
    logger.info(
        f"Monitoring {len(node_ids)} tag(s) "
        f"[connection_id={connection_id}, interval={monitor_interval}s]"
    )

    try:
        await asyncio.gather(
            _monitor_loop(websocket, connection_id, nodes, node_ids, monitor_interval),
            _ping_loop(websocket, connection_id),
        )
    except Exception:
        pass
    finally:
        logger.info(f"WebSocket closed [connection_id={connection_id}]")


async def _monitor_loop(
    websocket: WebSocket,
    connection_id: int,
    nodes: list,
    node_ids: list,
    interval: float,
) -> None:
    """
    Reads all monitored tags every `interval` seconds
    and pushes results to the client.
    """
    while True:
        if not opcua_manager.is_connected(connection_id):
            logger.warning(f"OPC UA connection lost during monitoring [connection_id={connection_id}]")
            await websocket.send_json({"error": "OPC UA connection lost."})
            await websocket.close()
            return

        readings = []
        for i, node in enumerate(nodes):
            try:
                value = await node.read_value()
                readings.append({
                    "node_id": node_ids[i],
                    "value": str(value),
                    "error": None
                })
            except Exception as e:
                readings.append({
                    "node_id": node_ids[i],
                    "value": None,
                    "error": str(e)
                })

        await websocket.send_json({"readings": readings})
        await asyncio.sleep(interval)


async def _ping_loop(websocket: WebSocket, connection_id: int) -> None:
    """
    Sends a ping every PING_INTERVAL_SECONDS to detect dead connections.
    """
    while True:
        await asyncio.sleep(PING_INTERVAL_SECONDS)
        try:
            await websocket.send_json({"type": "ping"})
            logger.debug(f"Ping sent [connection_id={connection_id}]")
        except Exception:
            logger.info(f"Ping failed — client is gone [connection_id={connection_id}]")
            return