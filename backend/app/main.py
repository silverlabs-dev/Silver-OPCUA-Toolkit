# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import init_db, AsyncSessionLocal
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api.routes.connections import router as connections_router
from app.api.routes.tags import router as tags_router
from app.api.routes.websocket import router as websocket_router
from app.opcua.manager import opcua_manager
from app.models.connection import Connection
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize logging as the very first thing inside the worker process
    setup_logging()

    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [{settings.ENV}]")

    # Create all DB tables if they don't exist yet
    await init_db()

    # Auto-reconnect any connections that were active before last shutdown
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Connection).where(Connection.is_active == True)
        )
        active_connections = result.scalars().all()
        for conn in active_connections:
            success = await opcua_manager.connect(conn.id, conn.endpoint)
            if not success:
                conn.is_active = False
                await db.commit()
                logger.warning(f"Auto-reconnect failed for connection {conn.id} ({conn.endpoint})")
            else:
                logger.info(f"Auto-reconnected connection {conn.id} ({conn.endpoint})")

    yield  # Server runs here

    # Shutdown — close all active OPC UA connections cleanly
    logger.info("Shutting down — closing all OPC UA connections...")
    await opcua_manager.disconnect_all()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="OPC UA Tooling for Industrial Engineers",
    lifespan=lifespan
)

# Allow the frontend dev server to make requests to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route groups
app.include_router(connections_router)  # /api/v1/connections
app.include_router(tags_router)         # /api/v1/tags
app.include_router(websocket_router)    # /ws/{connection_id}/monitor


@app.get("/health")
async def health_check():
    """Simple health check endpoint to verify the server is running."""
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "env": settings.ENV,
    }