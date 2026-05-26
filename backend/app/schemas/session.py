from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.session import SessionStatus

class SessionBase(BaseModel):
    subject_id: Optional[UUID] = None
    planned_duration_seconds: int
    notes: Optional[str] = None

class SessionCreate(SessionBase):
    pass

class SessionComplete(BaseModel):
    actual_duration_seconds: int
    pause_duration_seconds: int
    notes: Optional[str] = None

class SessionResponse(SessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    actual_duration_seconds: int
    pause_duration_seconds: int
    status: SessionStatus
    started_at: datetime
    ended_at: Optional[datetime] = None
