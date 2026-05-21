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

    model_config = {"from_attributes": True}