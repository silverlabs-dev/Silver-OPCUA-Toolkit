import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.opcua.manager import opcua_manager

router = APIRouter()


@router.websocket("/ws/{connection_id}/monitor")
async def monitor_tags(websocket: WebSocket, connection_id: int):
    """
    WebSocket endpoint for real-time tag monitoring.
    Accepts a list of node_ids from the client, then streams
    their current values every second until the client disconnects.
    """
    # Accept the incoming WebSocket connection from the frontend
    await websocket.accept()

    # Check if we have an active OPC UA client for this connection
    client = opcua_manager.get_client(connection_id)
    if not client:
        # Send error message and close if connection is not active
        await websocket.send_json({"error": "Connection is not active."})
        await websocket.close()
        return

    try:
        # Wait for the client to send the list of node_ids to monitor
        # Expected format: {"node_ids": ["ns=2;i=2", "ns=2;i=3"]}
        data = await websocket.receive_json()
        node_ids = data.get("node_ids", [])

        if not node_ids:
            await websocket.send_json({"error": "No node_ids provided."})
            await websocket.close()
            return

        # Resolve node_id strings to asyncua Node objects
        nodes = [client.get_node(nid) for nid in node_ids]

        # Continuously read and send tag values until client disconnects
        while True:
            readings = []

            for i, node in enumerate(nodes):
                try:
                    # Read the current value of each tag from OPC UA server
                    value = await node.read_value()
                    readings.append({
                        "node_id": node_ids[i],
                        "value": str(value),
                        "error": None
                    })
                except Exception as e:
                    # If a tag read fails, report it but keep monitoring others
                    readings.append({
                        "node_id": node_ids[i],
                        "value": None,
                        "error": str(e)
                    })

            # Send all current readings to the frontend as a JSON message
            await websocket.send_json({"readings": readings})

            # Wait 1 second before next read cycle
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        # Client disconnected — this is normal, just stop the loop
        pass
    except Exception as e:
        # Unexpected error — try to notify the client
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass