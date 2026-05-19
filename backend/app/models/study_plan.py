import uuid
import enum
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy import Date

from app.core.database import Base

class StudyPlanStatus(str, enum.Enum):
    active = "active"
    archived = "archived"
    completed = "completed"

class StudyPlanPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    exam_date = Column(Date, nullable=True)
    daily_hours_available = Column(Numeric(4, 2), nullable=False)
    plan_content = Column(Text, nullable=False)
    status = Column(SQLEnum(StudyPlanStatus, name="study_plan_status"), nullable=False, default=StudyPlanStatus.active, index=True)
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class StudyPlanSubject(Base):
    __tablename__ = "study_plan_subjects"

    study_plan_id = Column(UUID(as_uuid=True), ForeignKey("study_plans.id", ondelete="CASCADE"), primary_key=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True, index=True)
    priority = Column(SQLEnum(StudyPlanPriority, name="study_plan_priority"), nullable=False, default=StudyPlanPriority.medium)
