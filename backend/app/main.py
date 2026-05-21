from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.database import init_db, AsyncSessionLocal
from app.api.routes.connections import router as connections_router
from app.api.routes.tags import router as tags_router
from app.api.routes.websocket import router as websocket_router
from app.opcua.manager import opcua_manager
from app.models.connection import Connection
from sqlalchemy import select


@asynccontextmanager
async def lifespan(app: FastAPI):
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
                # If server is unreachable, mark as inactive in DB
                conn.is_active = False
                await db.commit()

    yield  # Server runs here


app = FastAPI(
    title="Industrial AI Toolkit",
    version="0.1.0",
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
    return {"status": "ok", "version": "0.1.0"}