"""Endpoints REST do módulo de Quiz.

Contrato espelha `frontend-atual/src/lib/mocks/handlers.ts` (quizzesHandlers):
* `POST /generate`            → 201 + Quiz com questions embedded
* `GET  /`                    → lista (sem questions)
* `GET  /{quiz_id}`           → quiz com questions
* `POST /{quiz_id}/start`     → muda status para in_progress
* `POST /{quiz_id}/questions/{question_id}/answer` → grava resposta + retorna feedback
* `POST /{quiz_id}/complete`  → calcula score, muda status para completed
* `POST /{quiz_id}/restart`   → zera respostas/score e retorna ao in_progress
* `DELETE /{quiz_id}`         → remove o quiz (perguntas e respostas vão por CASCADE)
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.integrations.openai_client import OpenAIClient, get_openai
from app.models.quiz import Quiz
from app.models.user import User
from app.schemas.quiz import (
    AnswerInput,
    AnswerResult,
    QuizCreate,
    QuizOut,
    QuizQuestionOut,
)
from app.services import quiz_service

router = APIRouter()


def _quiz_with_questions(db: Session, quiz: Quiz) -> QuizOut:
    questions = quiz_service.list_quiz_questions(db, quiz.id)
    out = QuizOut.model_validate(quiz)
    out.questions = [QuizQuestionOut.model_validate(q) for q in questions]
    return out


@router.post("/generate", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def generate_quiz(
    payload: QuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    openai: OpenAIClient = Depends(get_openai),
):
    quiz = quiz_service.create_quiz_from_topic(db, current_user, payload, openai)
    return _quiz_with_questions(db, quiz)


@router.get("", response_model=List[QuizOut])
def list_quizzes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return quiz_service.list_user_quizzes(db, current_user)


@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(
    quiz_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = quiz_service.get_user_quiz(db, current_user, quiz_id)
    return _quiz_with_questions(db, quiz)


@router.post("/{quiz_id}/start", response_model=QuizOut)
def start_quiz(
    quiz_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return quiz_service.start_quiz(db, current_user, quiz_id)


@router.post(
    "/{quiz_id}/questions/{question_id}/answer", response_model=AnswerResult
)
def answer_question(
    quiz_id: UUID,
    question_id: UUID,
    payload: AnswerInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return quiz_service.answer_question(
        db, current_user, quiz_id, question_id, payload.user_answer
    )


@router.post("/{quiz_id}/complete", response_model=QuizOut)
def complete_quiz(
    quiz_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return quiz_service.complete_quiz(db, current_user, quiz_id)


@router.post("/{quiz_id}/restart", response_model=QuizOut)
def restart_quiz(
    quiz_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = quiz_service.restart_quiz(db, current_user, quiz_id)
    return _quiz_with_questions(db, quiz)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz_service.delete_quiz(db, current_user, quiz_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
