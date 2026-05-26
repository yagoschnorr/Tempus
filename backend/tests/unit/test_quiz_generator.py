"""Testes unitários do quiz_generator.

Usa o `FakeOpenAI` do conftest (sem rede). Cada teste scripta a resposta que a
OpenAI "devolveria" e asserta sobre o resultado parseado e sobre o que foi
enviado para o cliente.
"""
from __future__ import annotations

import json

import pytest

from app.services.quiz_generator import (
    DEFAULT_MODEL,
    RESPONSE_FORMAT,
    QuizGenerationError,
    generate_questions_from_topic,
    generate_questions_from_documents,
)


def _chat_response(payload: dict) -> dict:
    """Envelope mínimo no formato chat.completions com `content` JSON."""
    return {"choices": [{"message": {"content": json.dumps(payload)}}]}


def _valid_question(seed: int = 0) -> dict:
    return {
        "question_text": f"Pergunta {seed}",
        "option_a": "alternativa A",
        "option_b": "alternativa B",
        "option_c": "alternativa C",
        "option_d": "alternativa D",
        "correct_answer": ["a", "b", "c", "d"][seed % 4],
        "explanation": f"Explicação {seed}",
    }


def test_generate_returns_parsed_questions(fake_openai):
    fake_openai.chat_responses.append(
        _chat_response({"questions": [_valid_question(i) for i in range(3)]})
    )

    result = generate_questions_from_topic(
        fake_openai, topic="Derivadas", total_questions=3
    )

    assert len(result) == 3
    # question_text é invariante ao shuffle (só alternativas são embaralhadas)
    assert [q.question_text for q in result] == [f"Pergunta {i}" for i in range(3)]
    # correct_answer sempre em {a,b,c,d}; o conjunto {option_a..d} continua sendo
    # as 4 alternativas originais (shuffle preserva o conjunto)
    for q in result:
        assert q.correct_answer in ("a", "b", "c", "d")
        assert {q.option_a, q.option_b, q.option_c, q.option_d} == {
            "alternativa A",
            "alternativa B",
            "alternativa C",
            "alternativa D",
        }


def test_generate_calls_openai_with_expected_args(fake_openai):
    fake_openai.chat_responses.append(
        _chat_response({"questions": [_valid_question(0)]})
    )

    generate_questions_from_topic(
        fake_openai, topic="Limites", total_questions=1, subject_name="Cálculo I"
    )

    kind, args = fake_openai.calls[0]
    assert kind == "chat"
    assert args["model"] == DEFAULT_MODEL
    assert args["response_format"] == RESPONSE_FORMAT
    assert args["messages"][0]["role"] == "system"
    user_content = args["messages"][1]["content"]
    assert "Limites" in user_content
    assert "Cálculo I" in user_content
    assert "EXATAMENTE 1" in user_content


def test_generate_raises_when_count_mismatch_after_retry(fake_openai):
    # 1ª e 2ª tentativa: ambos retornam contagem errada → falha após retry
    fake_openai.chat_responses.append(
        _chat_response({"questions": [_valid_question(0), _valid_question(1)]})
    )
    fake_openai.chat_responses.append(
        _chat_response({"questions": [_valid_question(0)]})
    )

    with pytest.raises(QuizGenerationError, match="esperado 5"):
        generate_questions_from_topic(
            fake_openai, topic="Algoritmos", total_questions=5
        )

    assert len(fake_openai.calls) == 2  # tentativa inicial + 1 retry


def test_generate_succeeds_on_retry(fake_openai):
    # 1ª tentativa: JSON inválido. 2ª tentativa: ok.
    fake_openai.chat_responses.append(
        {"choices": [{"message": {"content": "not json"}}]}
    )
    fake_openai.chat_responses.append(
        _chat_response({"questions": [_valid_question(0), _valid_question(1)]})
    )

    result = generate_questions_from_topic(
        fake_openai, topic="Grafos", total_questions=2
    )

    assert len(result) == 2
    assert len(fake_openai.calls) == 2


def test_generate_rejects_empty_topic(fake_openai):
    with pytest.raises(QuizGenerationError, match="vazio"):
        generate_questions_from_topic(
            fake_openai, topic="   ", total_questions=3
        )
    assert fake_openai.calls == []  # sequer chama a OpenAI


def test_generate_propagates_validation_errors(fake_openai):
    # `correct_answer` inválido (fora do enum) — Pydantic levanta ValidationError
    bad_question = _valid_question(0)
    bad_question["correct_answer"] = "e"
    fake_openai.chat_responses.append(_chat_response({"questions": [bad_question]}))
    fake_openai.chat_responses.append(_chat_response({"questions": [bad_question]}))

    with pytest.raises(QuizGenerationError):
        generate_questions_from_topic(
            fake_openai, topic="Probabilidade", total_questions=1
        )


def test_generate_raises_on_malformed_openai_envelope(fake_openai):
    # Envelope sem `choices` (estrutura inesperada da resposta) → QuizGenerationError
    fake_openai.chat_responses.append({})
    fake_openai.chat_responses.append({})

    with pytest.raises(QuizGenerationError, match="Estrutura inesperada"):
        generate_questions_from_topic(
            fake_openai, topic="Integrais", total_questions=2
        )


def test_generate_preserves_correct_alternative_text_after_shuffle(fake_openai):
    """Embaralhar muda a letra, mas o TEXTO da alternativa correta é preservado."""
    import random

    random.seed(7)  # determinístico

    # Resposta da IA: tudo concentrado em "a" (bias clássico do modelo)
    questions_raw = [
        {
            "question_text": f"Q{i}",
            "option_a": f"RESPOSTA-CERTA-{i}",
            "option_b": f"errada-b-{i}",
            "option_c": f"errada-c-{i}",
            "option_d": f"errada-d-{i}",
            "correct_answer": "a",
            "explanation": "...",
        }
        for i in range(8)
    ]
    fake_openai.chat_responses.append(
        {"choices": [{"message": {"content": json.dumps({"questions": questions_raw})}}]}
    )

    result = generate_questions_from_topic(
        fake_openai, topic="x", total_questions=8
    )

    for i, q in enumerate(result):
        expected_text = f"RESPOSTA-CERTA-{i}"
        actual_text = {
            "a": q.option_a, "b": q.option_b, "c": q.option_c, "d": q.option_d
        }[q.correct_answer]
        assert actual_text == expected_text, (
            f"Q{i}: correct_answer={q.correct_answer} aponta para '{actual_text}', "
            f"esperado '{expected_text}'"
        )

    # Verifica que não ficou tudo em "a" (o shuffle teve efeito real)
    correct_letters = {q.correct_answer for q in result}
    assert len(correct_letters) > 1, (
        f"shuffle não diversificou — todas em {correct_letters}"
    )


def test_generate_from_documents_success(fake_openai):
    fake_openai.chat_responses.append(
        _chat_response({"questions": [_valid_question(i) for i in range(2)]})
    )

    result = generate_questions_from_documents(
        fake_openai,
        context="Este é um trecho de teste.",
        total_questions=2,
        topic_description="Tema",
        subject_name="Matéria"
    )

    assert len(result) == 2
    assert [q.question_text for q in result] == ["Pergunta 0", "Pergunta 1"]

    kind, args = fake_openai.calls[0]
    assert kind == "chat"
    user_content = args["messages"][1]["content"]
    assert "Este é um trecho de teste." in user_content
    assert "Tema" in user_content
    assert "Matéria" in user_content


def test_generate_from_documents_empty_context(fake_openai):
    with pytest.raises(QuizGenerationError, match="context não pode ser vazio"):
        generate_questions_from_documents(
            fake_openai,
            context="   ",
            total_questions=2
        )

