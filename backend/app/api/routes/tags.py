from fastapi import APIRouter, HTTPException
from asyncua import ua
from asyncua.common.node import Node
from app.opcua.manager import opcua_manager
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


# Schema representing a single OPC UA node returned to the frontend
class NodeInfo(BaseModel):
    node_id: str        # Unique identifier of the node in OPC UA address space
    name: str           # Display name of the node
    node_class: str     # Type: Object (folder) or Variable (tag with value)
    value: str | None   # Current value — only available for Variable nodes


def parse_node_id(client, node_id_str: str) -> Node:
    """
    Convert a node_id string to an asyncua Node object.
    Supports both short format (ns=2;i=1) and the repr format
    returned by asyncua (NodeId(Identifier=1, NamespaceIndex=2, ...))
    """
    # If it's the repr format from asyncua, extract ns and identifier
    if node_id_str.startswith("NodeId("):
        import re
        identifier = re.search(r"Identifier=(\w+)", node_id_str)
        namespace = re.search(r"NamespaceIndex=(\d+)", node_id_str)
        if identifier and namespace:
            ns = namespace.group(1)
            ident = identifier.group(1)
            # Build standard OPC UA format
            try:
                node_id_str = f"ns={ns};i={ident}"
            except Exception:
                node_id_str = f"ns={ns};s={ident}"

    return client.get_node(node_id_str)


@router.get("/{connection_id}/browse", response_model=list[NodeInfo])
async def browse_tags(connection_id: int, node_id: str | None = None):
    """
    Browse the OPC UA node tree for a given connection.
    If node_id is provided, browse children of that node.
    If not provided, start from the root Objects folder.
    """
    # Check if we have an active OPC UA client for this connection
    client = opcua_manager.get_client(connection_id)
    if not client:
        raise HTTPException(
            status_code=400,
            detail="Connection is not active. Please connect first."
        )

    try:
        # Determine starting node — either specified node or root Objects folder
        if node_id:
            parent_node = parse_node_id(client, node_id)
        else:
            parent_node = client.get_objects_node()

        # Get all direct children of the selected node
        children = await parent_node.get_children()

        nodes = []
        for child in children:
            # Read the display name of each child node
            browse_name = await child.read_browse_name()
            name = browse_name.Name

            # Get node class — Object means folder, Variable means it has a value
            node_class = await child.read_node_class()
            node_class_str = "Object" if node_class == ua.NodeClass.Object else "Variable"

            # Try to read current value — only works for Variable nodes
            value = None
            if node_class == ua.NodeClass.Variable:
                try:
                    raw_value = await child.read_value()
                    value = str(raw_value)
                except Exception:
                    value = "N/A"

            nodes.append(NodeInfo(
                node_id=str(child.nodeid),
                name=name,
                node_class=node_class_str,
                value=value,
            ))

        return nodes

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Browse failed: {str(e)}")