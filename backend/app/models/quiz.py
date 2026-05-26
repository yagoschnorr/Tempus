import uuid
import enum
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text, Table, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

class QuizSourceType(str, enum.Enum):
    documents = "documents"
    general_topic = "general_topic"

class QuizStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"

class QuizOption(str, enum.Enum):
    a = "a"
    b = "b"
    c = "c"
    d = "d"

quiz_sources = Table(
    "quiz_sources",
    Base.metadata,
    Column("quiz_id", UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True, index=True)
)

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    source_type = Column(SQLEnum(QuizSourceType, name="quiz_source_type"), nullable=False)
    topic_description = Column(Text, nullable=True)
    total_questions = Column(Integer, nullable=False)
    score = Column(Integer, nullable=True)
    status = Column(SQLEnum(QuizStatus, name="quiz_status"), nullable=False, default=QuizStatus.pending, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    documents = relationship("Document", secondary=quiz_sources)

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    question_index = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_answer = Column(SQLEnum(QuizOption, name="quiz_option"), nullable=False)
    explanation = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint('quiz_id', 'question_index', name='quiz_questions_quiz_id_question_index_key'),
    )

class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_question_id = Column(UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_answer = Column(SQLEnum(QuizOption, name="quiz_option"), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    answered_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
