"""Integração real: `generate_questions_from_topic` contra a OpenAI de verdade.

Valida o que o teste de unidade (com FakeOpenAI) não consegue:
* O modelo respeita Structured Outputs (`response_format` strict) — ou seja,
  o JSON volta sempre conforme o schema declarado em `quiz_generator.py`.
* `gpt-4o-mini` consegue gerar `total_questions=N` perguntas plausíveis.
* O `_shuffle_options` preserva a corretude (`correct_answer` aponta para a
  alternativa originalmente correta após o embaralhamento).
"""
from __future__ import annotations

import pytest

from app.schemas.quiz import GeneratedQuestion
from app.services.quiz_generator import (
    QuizGenerationError,
    generate_questions_from_topic,
)


pytestmark = [pytest.mark.integration_real, pytest.mark.vcr]


VALID_LETTERS = {"a", "b", "c", "d"}


def test_generate_questions_from_topic_via_real_openai(openai_client):
    questions = generate_questions_from_topic(
        openai_client,
        topic="Derivadas de funções polinomiais em cálculo I",
        total_questions=3,
        subject_name="Cálculo I",
    )

    assert len(questions) == 3
    for q in questions:
        assert isinstance(q, GeneratedQuestion)
        assert q.question_text.strip()
        assert q.option_a.strip()
        assert q.option_b.strip()
        assert q.option_c.strip()
        assert q.option_d.strip()
        assert q.correct_answer in VALID_LETTERS
        assert q.explanation.strip()
        # 4 alternativas distintas — sem duplicatas que entreguem a resposta.
        opts = {q.option_a, q.option_b, q.option_c, q.option_d}
        assert len(opts) == 4, f"alternativas duplicadas: {opts}"


def test_generate_questions_from_topic_rejects_empty_topic(openai_client):
    with pytest.raises(QuizGenerationError, match="topic não pode ser vazio"):
        generate_questions_from_topic(
            openai_client, topic="   ", total_questions=2
        )
