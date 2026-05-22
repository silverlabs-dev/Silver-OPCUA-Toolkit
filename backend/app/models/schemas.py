# backend/app/models/schemas.py

from pydantic import BaseModel, field_validator
from datetime import datetime


class ConnectionCreate(BaseModel):
    name: str
    endpoint: str

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, v: str) -> str:
        if not v.startswith("opc.tcp://"):
            raise ValueError("Endpoint must start with opc.tcp://")
        return v


class ConnectionResponse(BaseModel):
    id: int
    name: str
    endpoint: str
    is_active: bool
    created_at: datetime

    # State machine fields
    last_connected_at: datetime | None = None
    last_error: str | None = None
    retry_count: int = 0

    model_config = {"from_attributes": True}