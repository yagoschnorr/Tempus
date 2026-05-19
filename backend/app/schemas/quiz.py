"""Schemas Pydantic do módulo de Quiz.

Divididos em três camadas:
* **Input**: o que chega do frontend (`QuizCreate`, `AnswerInput`).
* **Output**: o que volta para o frontend (`QuizOut`, `QuizQuestionOut`, `AnswerResult`).
* **Internal**: validação da saída da OpenAI antes de persistir (`GeneratedQuestion`,
  `GeneratedQuiz`). Manter separado do `QuizQuestionOut` porque a geração não tem
  ainda `id`/`quiz_id`/`question_index` — esses só existem após persistência.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.quiz import QuizOption, QuizSourceType, QuizStatus


# =============================================================================
# Input
# =============================================================================
class QuizCreate(BaseModel):
    subject_id: Optional[UUID] = None
    source_type: QuizSourceType
    topic_description: Optional[str] = None
    document_ids: Optional[list[UUID]] = None
    total_questions: int = Field(gt=0, le=20)

    @model_validator(mode="after")
    def _enforce_source_invariants(self) -> "QuizCreate":
        # Espelha o CHECK chk_topic_when_general do schema SQL: se a origem é tema
        # livre, topic_description é obrigatório e não pode ser só espaços.
        if self.source_type == QuizSourceType.general_topic:
            if not self.topic_description or not self.topic_description.strip():
                raise ValueError(
                    "topic_description é obrigatório quando source_type='general_topic'"
                )
        # Regra de negócio (não está no SQL como CHECK): quiz baseado em documentos
        # precisa de pelo menos um document_id para o retrieval funcionar.
        if self.source_type == QuizSourceType.documents:
            if not self.document_ids:
                raise ValueError(
                    "document_ids é obrigatório quando source_type='documents'"
                )
        return self


class AnswerInput(BaseModel):
    user_answer: QuizOption


# =============================================================================
# Output
# =============================================================================
class QuizQuestionOut(BaseModel):
    id: UUID
    quiz_id: UUID
    question_index: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: QuizOption
    explanation: str

    model_config = ConfigDict(from_attributes=True)


class QuizOut(BaseModel):
    id: UUID
    user_id: UUID
    subject_id: Optional[UUID]
    title: str
    source_type: QuizSourceType
    topic_description: Optional[str]
    total_questions: int
    score: Optional[int]
    status: QuizStatus
    created_at: datetime
    completed_at: Optional[datetime]
    questions: Optional[list[QuizQuestionOut]] = None

    model_config = ConfigDict(from_attributes=True)


class AnswerResult(BaseModel):
    is_correct: bool
    correct_answer: QuizOption
    explanation: str


# =============================================================================
# Internal — validação da saída da OpenAI
# =============================================================================
class GeneratedQuestion(BaseModel):
    question_text: str = Field(min_length=1)
    option_a: str = Field(min_length=1)
    option_b: str = Field(min_length=1)
    option_c: str = Field(min_length=1)
    option_d: str = Field(min_length=1)
    correct_answer: QuizOption
    explanation: str = Field(min_length=1)


class GeneratedQuiz(BaseModel):
    questions: list[GeneratedQuestion]
