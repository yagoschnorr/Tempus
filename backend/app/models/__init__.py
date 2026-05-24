from app.core.database import Base

# Importando todos os modelos para que o Alembic consiga identificá-los ao ler Base.metadata
from app.models.user import User
from app.models.subject import Subject
from app.models.session import StudySession, SessionStatus
from app.models.document import Document, DocumentChunk, Tag, document_tags, DocumentStatus
from app.models.quiz import Quiz, QuizQuestion, QuizAnswer, quiz_sources, QuizSourceType, QuizStatus, QuizOption
from app.models.study_plan import StudyPlan, StudyPlanSubject, StudyPlanStatus, StudyPlanPriority
from app.models.notebook import Notebook, Note
from app.models.progress import ProgressReport, ProgressReportSubject
from app.models.email_change_request import EmailChangeRequest
from app.models.chat import ChatSession, ChatMessage, ChatMessageSource, ChatRole