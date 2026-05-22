# backend/app/api/routes/websocket.py

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.opcua.manager import opcua_manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# How often (in seconds) to read and push tag values to the client
MONITOR_INTERVAL_SECONDS = 1.0

# How long to wait for the initial node_ids message from the client
HANDSHAKE_TIMEOUT_SECONDS = 10.0

# How often to send a ping to detect dead connections
PING_INTERVAL_SECONDS = 5.0


@router.websocket("/ws/{connection_id}/monitor")
async def monitor_tags(websocket: WebSocket, connection_id: int):
    """
    WebSocket endpoint for real-time tag monitoring.
    Accepts a list of node_ids from the client, then streams
    their current values every second until the client disconnects.
    """
    await websocket.accept()
    logger.info(f"WebSocket opened [connection_id={connection_id}]")

    # Verify OPC UA client exists before doing anything
    client = opcua_manager.get_client(connection_id)
    if not client:
        logger.warning(f"WebSocket rejected — OPC UA connection {connection_id} is not active")
        await websocket.send_json({"error": "OPC UA connection is not active."})
        await websocket.close()
        return

    # Wait for the client to send node_ids, with a timeout
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

    # Resolve node_id strings to asyncua Node objects
    nodes = [client.get_node(nid) for nid in node_ids]
    logger.info(f"Monitoring {len(node_ids)} tag(s) [connection_id={connection_id}]")

    # Run monitor loop and ping loop concurrently
    try:
        await asyncio.gather(
            _monitor_loop(websocket, connection_id, nodes, node_ids),
            _ping_loop(websocket, connection_id),
        )
    except Exception:
        # Either loop raised — connection is gone, fall through to cleanup
        pass
    finally:
        logger.info(f"WebSocket closed [connection_id={connection_id}]")


async def _monitor_loop(
    websocket: WebSocket,
    connection_id: int,
    nodes: list,
    node_ids: list,
) -> None:
    """
    Reads all monitored tags every MONITOR_INTERVAL_SECONDS
    and pushes results to the client.
    Exits when the WebSocket is closed or OPC UA connection is lost.
    """
    while True:
        # Check OPC UA connection is still alive before reading
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
                # Tag read failed — report it but keep monitoring other tags
                readings.append({
                    "node_id": node_ids[i],
                    "value": None,
                    "error": str(e)
                })

        await websocket.send_json({"readings": readings})
        await asyncio.sleep(MONITOR_INTERVAL_SECONDS)


async def _ping_loop(websocket: WebSocket, connection_id: int) -> None:
    """
    Sends a WebSocket ping every PING_INTERVAL_SECONDS.
    If the client is gone, ping() raises and the loop exits —
    which cancels _monitor_loop via asyncio.gather().
    """
    while True:
        await asyncio.sleep(PING_INTERVAL_SECONDS)
        try:
            await websocket.send_json({"type": "ping"})
            logger.debug(f"Ping sent [connection_id={connection_id}]")
        except Exception:
            logger.info(f"Ping failed — client is gone [connection_id={connection_id}]")
            return