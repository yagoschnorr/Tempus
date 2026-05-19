import uuid
from sqlalchemy import Column, DateTime, Integer, ForeignKey, Text, Numeric, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base

class ProgressReport(Base):
    __tablename__ = "progress_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    total_study_minutes = Column(Integer, nullable=False, default=0)
    total_sessions = Column(Integer, nullable=False, default=0)
    completed_sessions = Column(Integer, nullable=False, default=0)
    avg_quiz_score = Column(Numeric(5, 2), nullable=True)
    total_quizzes_completed = Column(Integer, nullable=False, default=0)
    ai_narrative = Column(Text, nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'period_start', 'period_end', name='progress_reports_user_period_key'),
    )


class ProgressReportSubject(Base):
    __tablename__ = "progress_report_subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    progress_report_id = Column(UUID(as_uuid=True), ForeignKey("progress_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    minutes_studied = Column(Integer, nullable=False, default=0)
    sessions_count = Column(Integer, nullable=False, default=0)
    avg_quiz_score = Column(Numeric(5, 2), nullable=True)
    quizzes_completed = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint('progress_report_id', 'subject_id', name='progress_report_subjects_report_subject_key'),
    )
