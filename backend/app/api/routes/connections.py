from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.connection import Connection
from app.models.schemas import ConnectionCreate, ConnectionResponse
from app.opcua.manager import opcua_manager

# APIRouter groups all endpoints under /api/v1/connections
# tags are used for grouping in Swagger UI
router = APIRouter(prefix="/api/v1/connections", tags=["connections"])


@router.get("/", response_model=list[ConnectionResponse])
async def list_connections(db: AsyncSession = Depends(get_db)):
    """Return all saved OPC UA connections from the database."""
    result = await db.execute(select(Connection))
    return result.scalars().all()


@router.post("/", response_model=ConnectionResponse)
async def create_connection(
    data: ConnectionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Save a new OPC UA connection to the database."""
    # Build a DB object from the validated request data
    connection = Connection(name=data.name, endpoint=data.endpoint)
    db.add(connection)
    await db.commit()
    # Refresh to get DB-generated fields like id and created_at
    await db.refresh(connection)
    return connection


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a connection from the database."""
    # Check if the connection exists before deleting
    result = await db.execute(
        select(Connection).where(Connection.id == connection_id)
    )
    connection = result.scalar_one_or_none()

    # Return 404 if not found
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    await db.delete(connection)
    await db.commit()
    return {"message": "Connection deleted"}


@router.post("/{connection_id}/connect", response_model=ConnectionResponse)
async def connect_to_server(
    connection_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Actually connect to the OPC UA server and update status in DB."""
    # Find the connection record in the database
    result = await db.execute(
        select(Connection).where(Connection.id == connection_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Ask OPC UA Manager to establish the real connection
    # Returns False if server is unreachable or connection fails
    success = await opcua_manager.connect(connection_id, connection.endpoint)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to connect to OPC UA server")

    # Connection succeeded — mark as active in the database
    connection.is_active = True
    await db.commit()
    await db.refresh(connection)
    return connection


@router.post("/{connection_id}/disconnect", response_model=ConnectionResponse)
async def disconnect_from_server(
    connection_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Close the OPC UA connection and mark as inactive in DB."""
    result = await db.execute(
        select(Connection).where(Connection.id == connection_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Tell OPC UA Manager to close the connection
    await opcua_manager.disconnect(connection_id)

    # Mark as inactive in the database
    connection.is_active = False
    await db.commit()
    await db.refresh(connection)
    return connection