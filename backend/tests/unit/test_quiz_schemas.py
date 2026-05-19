"""Validador de QuizCreate — espelho do CHECK `chk_topic_when_general` do SQL."""
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.quiz import QuizCreate


def test_general_topic_requires_topic_description():
    with pytest.raises(ValidationError, match="topic_description é obrigatório"):
        QuizCreate(source_type="general_topic", total_questions=5)


def test_general_topic_rejects_blank_topic_description():
    with pytest.raises(ValidationError, match="topic_description é obrigatório"):
        QuizCreate(
            source_type="general_topic",
            topic_description="   ",
            total_questions=5,
        )


def test_general_topic_accepts_valid_payload():
    quiz = QuizCreate(
        source_type="general_topic",
        topic_description="Derivadas",
        total_questions=5,
    )
    assert quiz.topic_description == "Derivadas"


def test_documents_requires_document_ids():
    with pytest.raises(ValidationError, match="document_ids é obrigatório"):
        QuizCreate(source_type="documents", total_questions=5)


def test_documents_accepts_valid_payload():
    quiz = QuizCreate(
        source_type="documents",
        document_ids=[uuid4()],
        total_questions=5,
    )
    assert len(quiz.document_ids) == 1


def test_total_questions_must_be_positive():
    with pytest.raises(ValidationError):
        QuizCreate(
            source_type="general_topic",
            topic_description="x",
            total_questions=0,
        )


def test_total_questions_capped_at_20():
    with pytest.raises(ValidationError):
        QuizCreate(
            source_type="general_topic",
            topic_description="x",
            total_questions=21,
        )
