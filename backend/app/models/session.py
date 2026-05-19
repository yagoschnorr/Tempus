import uuid
import enum
from sqlalchemy import Column, DateTime, Integer, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base

class SessionStatus(str, enum.Enum):
    in_progress = "in_progress"
    paused = "paused"
    completed = "completed"
    abandoned = "abandoned"

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    planned_duration_seconds = Column(Integer, nullable=False)
    actual_duration_seconds = Column(Integer, nullable=False, default=0)
    pause_duration_seconds = Column(Integer, nullable=False, default=0)
    status = Column(SQLEnum(SessionStatus, name="session_status"), nullable=False, default=SessionStatus.in_progress)
    notes = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
