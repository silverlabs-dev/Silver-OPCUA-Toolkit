# backend/app/api/routes/connections.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.connection import Connection
from app.models.schemas import ConnectionCreate, ConnectionResponse
from app.opcua.manager import opcua_manager
import logging

logger = logging.getLogger(__name__)

# APIRouter groups all endpoints under /api/v1/connections
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
    connection = Connection(name=data.name, endpoint=data.endpoint)
    db.add(connection)
    await db.commit()
    await db.refresh(connection)
    logger.info(f"Connection created [id={connection.id}, name={connection.name}]")
    return connection


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a connection from the database and close it if active."""
    result = await db.execute(
        select(Connection).where(Connection.id == connection_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    # If connection is active, close it cleanly before deleting
    if opcua_manager.is_connected(connection_id):
        await opcua_manager.disconnect(connection_id)
        logger.info(f"Closed active connection before delete [id={connection_id}]")

    await db.delete(connection)
    await db.commit()
    logger.info(f"Connection deleted [id={connection_id}]")
    return {"message": "Connection deleted"}


@router.post("/{connection_id}/connect", response_model=ConnectionResponse)
async def connect_to_server(
    connection_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Actually connect to the OPC UA server and update status in DB."""
    result = await db.execute(
        select(Connection).where(Connection.id == connection_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    success = await opcua_manager.connect(connection_id, connection.endpoint)

    if not success:
        # Record the failure in DB for observability
        connection.is_active = False
        connection.retry_count += 1
        connection.last_error = f"Failed to connect to {connection.endpoint}"
        await db.commit()
        await db.refresh(connection)
        logger.warning(
            f"Connection failed [id={connection_id}, "
            f"endpoint={connection.endpoint}, "
            f"retry_count={connection.retry_count}]"
        )
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to OPC UA server at {connection.endpoint}"
        )

    # Connection succeeded — update state
    connection.is_active = True
    connection.last_connected_at = datetime.now(timezone.utc)
    connection.last_error = None
    connection.retry_count = 0
    await db.commit()
    await db.refresh(connection)
    logger.info(
        f"Connection established [id={connection_id}, endpoint={connection.endpoint}]"
    )
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

    await opcua_manager.disconnect(connection_id)

    connection.is_active = False
    await db.commit()
    await db.refresh(connection)
    logger.info(f"Connection closed [id={connection_id}]")
    return connection