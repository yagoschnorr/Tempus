"""Serviço de Quiz: orquestra geração via IA, persistência e máquina de estados.

Máquina de estados:
    pending  ──start──▶  in_progress  ──complete──▶  completed
                              │
                              └──answer──▶ (persiste QuizAnswer; permanece in_progress)

Constraints relevantes do schema SQL espelhadas na lógica:
* `quiz_questions UNIQUE (quiz_id, question_index)` — atribuímos índice sequencial 0..N-1.
* `quiz_answers.quiz_question_id UNIQUE` — verificamos antes de inserir para
  retornar 400 limpo em vez de 500 (IntegrityError).
* `quizzes.title VARCHAR(200)` — `_build_title` trunca o tema.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.integrations.openai_client import OpenAIClient
from app.models.quiz import (
    Quiz,
    QuizAnswer,
    QuizOption,
    QuizQuestion,
    QuizSourceType,
    QuizStatus,
)
from app.models.subject import Subject
from app.models.user import User
from app.schemas.quiz import AnswerResult, QuizCreate
from app.services.quiz_generator import (
    QuizGenerationError,
    generate_questions_from_topic,
)


TITLE_PREFIX = "Quiz: "
TITLE_MAX = 200  # bate com VARCHAR(200) em quizzes.title


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _build_title(topic: Optional[str]) -> str:
    base = (topic or "documentos selecionados").strip()
    budget = TITLE_MAX - len(TITLE_PREFIX)
    return TITLE_PREFIX + base[:budget]


def _resolve_subject_name(
    db: Session, user_id: UUID, subject_id: Optional[UUID]
) -> Optional[str]:
    if subject_id is None:
        return None
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == user_id)
        .first()
    )
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Matéria não encontrada"
        )
    return subject.name


def _get_quiz_owned_by_user(db: Session, user_id: UUID, quiz_id: UUID) -> Quiz:
    quiz = (
        db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user_id).first()
    )
    if quiz is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Quiz não encontrado"
        )
    return quiz


# ---------------------------------------------------------------------------
# Operações
# ---------------------------------------------------------------------------
def create_quiz_from_topic(
    db: Session,
    user: User,
    payload: QuizCreate,
    openai: OpenAIClient,
) -> Quiz:
    """Gera perguntas via IA e persiste o quiz + suas perguntas atomicamente."""
    if payload.source_type != QuizSourceType.general_topic:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="source_type='documents' será disponibilizado na Sprint 3 (RAG)",
        )

    subject_name = _resolve_subject_name(db, user.id, payload.subject_id)

    try:
        generated = generate_questions_from_topic(
            openai,
            topic=payload.topic_description or "",
            total_questions=payload.total_questions,
            subject_name=subject_name,
        )
    except QuizGenerationError as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao gerar quiz com a IA: {err}",
        )

    quiz = Quiz(
        user_id=user.id,
        subject_id=payload.subject_id,
        title=_build_title(payload.topic_description),
        source_type=payload.source_type,
        topic_description=payload.topic_description,
        total_questions=payload.total_questions,
        status=QuizStatus.pending,
    )
    db.add(quiz)
    db.flush()  # garante quiz.id antes de criar perguntas

    for idx, gen in enumerate(generated):
        db.add(
            QuizQuestion(
                quiz_id=quiz.id,
                question_index=idx,
                question_text=gen.question_text,
                option_a=gen.option_a,
                option_b=gen.option_b,
                option_c=gen.option_c,
                option_d=gen.option_d,
                correct_answer=gen.correct_answer,
                explanation=gen.explanation,
            )
        )

    db.commit()
    db.refresh(quiz)
    return quiz


def list_user_quizzes(db: Session, user: User) -> List[Quiz]:
    return (
        db.query(Quiz)
        .filter(Quiz.user_id == user.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )


def get_user_quiz(db: Session, user: User, quiz_id: UUID) -> Quiz:
    return _get_quiz_owned_by_user(db, user.id, quiz_id)


def list_quiz_questions(db: Session, quiz_id: UUID) -> List[QuizQuestion]:
    return (
        db.query(QuizQuestion)
        .filter(QuizQuestion.quiz_id == quiz_id)
        .order_by(QuizQuestion.question_index)
        .all()
    )


def start_quiz(db: Session, user: User, quiz_id: UUID) -> Quiz:
    quiz = _get_quiz_owned_by_user(db, user.id, quiz_id)
    if quiz.status != QuizStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quiz já está {quiz.status.value}",
        )
    quiz.status = QuizStatus.in_progress
    db.commit()
    db.refresh(quiz)
    return quiz


def answer_question(
    db: Session,
    user: User,
    quiz_id: UUID,
    question_id: UUID,
    user_answer: QuizOption,
) -> AnswerResult:
    quiz = _get_quiz_owned_by_user(db, user.id, quiz_id)
    if quiz.status != QuizStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quiz precisa estar in_progress para responder",
        )

    question = (
        db.query(QuizQuestion)
        .filter(QuizQuestion.id == question_id, QuizQuestion.quiz_id == quiz_id)
        .first()
    )
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pergunta não encontrada"
        )

    already = (
        db.query(QuizAnswer)
        .filter(QuizAnswer.quiz_question_id == question_id)
        .first()
    )
    if already is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pergunta já foi respondida",
        )

    is_correct = user_answer == question.correct_answer
    db.add(
        QuizAnswer(
            quiz_question_id=question_id,
            user_answer=user_answer,
            is_correct=is_correct,
        )
    )
    db.commit()

    return AnswerResult(
        is_correct=is_correct,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
    )


def complete_quiz(db: Session, user: User, quiz_id: UUID) -> Quiz:
    quiz = _get_quiz_owned_by_user(db, user.id, quiz_id)
    if quiz.status != QuizStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quiz precisa estar in_progress para concluir",
        )

    question_ids = [q.id for q in list_quiz_questions(db, quiz.id)]
    correct = (
        db.query(QuizAnswer)
        .filter(
            QuizAnswer.quiz_question_id.in_(question_ids),
            QuizAnswer.is_correct.is_(True),
        )
        .count()
    )
    quiz.score = round((correct / quiz.total_questions) * 100)
    quiz.status = QuizStatus.completed
    quiz.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(quiz)
    return quiz


def restart_quiz(db: Session, user: User, quiz_id: UUID) -> Quiz:
    """Reseta o quiz para in_progress, descartando score, completed_at e
    todas as respostas anteriores. Idempotente.

    Aceito a partir de qualquer status: o caso típico é refazer um quiz
    `completed`, mas reiniciar um `in_progress` (limpando respostas parciais)
    ou um `pending` também é válido.
    """
    quiz = _get_quiz_owned_by_user(db, user.id, quiz_id)

    question_ids = [q.id for q in list_quiz_questions(db, quiz.id)]
    if question_ids:
        (
            db.query(QuizAnswer)
            .filter(QuizAnswer.quiz_question_id.in_(question_ids))
            .delete(synchronize_session=False)
        )

    quiz.status = QuizStatus.in_progress
    quiz.score = None
    quiz.completed_at = None
    db.commit()
    db.refresh(quiz)
    return quiz


def delete_quiz(db: Session, user: User, quiz_id: UUID) -> None:
    """Remove o quiz. `quiz_questions` e `quiz_answers` somem por CASCADE."""
    quiz = _get_quiz_owned_by_user(db, user.id, quiz_id)
    db.delete(quiz)
    db.commit()
