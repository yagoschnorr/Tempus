"""Gera perguntas de quiz via OpenAI (Structured Outputs + validação Pydantic).

Sprint 2 cobre apenas `source_type=general_topic` (sem RAG).
Sprint 3 plugará a variante `documents` reusando o mesmo gerador,
passando o contexto extraído dos chunks no prompt do usuário.

Decisões:
* Modelo: `gpt-4o-mini` — barato, suficiente para quiz educacional.
* Formato: Structured Outputs (`response_format={"type":"json_schema",...}`,
  `strict=True`) garante que a saída sempre satisfaz o schema; ainda assim
  validamos com Pydantic e checamos contagem de perguntas (a API não impõe).
* Retry: 1× por padrão — falhas de geração quase sempre são determinísticas
  (modelo errado, schema errado, prompt vazio); muitos retries só pioram custo.
"""
from __future__ import annotations

import json
import random
from typing import Any, Optional

from pydantic import ValidationError

from app.integrations.openai_client import OpenAIClient
from app.schemas.quiz import GeneratedQuestion, GeneratedQuiz

DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TEMPERATURE = 0.7
_LETTERS = ("a", "b", "c", "d")


def _shuffle_options(question: GeneratedQuestion) -> GeneratedQuestion:
    """Embaralha as 4 alternativas e ajusta `correct_answer`.

    LLMs têm bias forte para colocar a resposta correta em 'a'. O shuffle
    posicional resolve isso independentemente do prompt — o conteúdo de cada
    alternativa fica intacto e `correct_answer` passa a apontar para a nova
    posição da alternativa originalmente correta.
    """
    texts = [
        question.option_a,
        question.option_b,
        question.option_c,
        question.option_d,
    ]
    correct_idx = _LETTERS.index(question.correct_answer)

    indexed = list(enumerate(texts))
    random.shuffle(indexed)

    new_correct_pos = next(
        pos for pos, (orig, _) in enumerate(indexed) if orig == correct_idx
    )
    shuffled = [text for _, text in indexed]

    return GeneratedQuestion(
        question_text=question.question_text,
        option_a=shuffled[0],
        option_b=shuffled[1],
        option_c=shuffled[2],
        option_d=shuffled[3],
        correct_answer=_LETTERS[new_correct_pos],
        explanation=question.explanation,
    )

SYSTEM_PROMPT = """Você é um especialista em criar questionários educacionais em português do Brasil.
Gere perguntas de múltipla escolha com exatamente 4 alternativas (a, b, c, d).

Regras obrigatórias:
- Cada pergunta tem exatamente UMA resposta correta.
- As 4 alternativas devem ser plausíveis (sem alternativas absurdas que entregam a resposta).
- A explicação deve justificar por que a alternativa correta está certa e, idealmente,
  apontar por que as outras estão erradas.
- Linguagem clara, sem jargões desnecessários.
- Nível de dificuldade: intermediário, adequado para estudantes universitários."""

_QUESTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "question_text",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "correct_answer",
        "explanation",
    ],
    "properties": {
        "question_text": {"type": "string"},
        "option_a": {"type": "string"},
        "option_b": {"type": "string"},
        "option_c": {"type": "string"},
        "option_d": {"type": "string"},
        "correct_answer": {"type": "string", "enum": ["a", "b", "c", "d"]},
        "explanation": {"type": "string"},
    },
}

RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "quiz_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["questions"],
            "properties": {
                "questions": {"type": "array", "items": _QUESTION_SCHEMA},
            },
        },
    },
}


class QuizGenerationError(RuntimeError):
    """Falha irrecuperável ao gerar quiz via OpenAI."""


def _build_user_prompt(topic: str, total: int, subject_name: Optional[str]) -> str:
    lines = [
        f"Crie um quiz com EXATAMENTE {total} perguntas sobre o tema abaixo.",
        "",
        "Tema:",
        topic.strip(),
    ]
    if subject_name:
        lines.extend(["", f"Matéria de referência: {subject_name}"])
    return "\n".join(lines)


def _extract_content(response: dict[str, Any]) -> str:
    try:
        return response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as err:
        raise QuizGenerationError(
            f"Estrutura inesperada de resposta da OpenAI: {err}"
        ) from err


def generate_questions_from_topic(
    client: OpenAIClient,
    *,
    topic: str,
    total_questions: int,
    subject_name: Optional[str] = None,
    max_retries: int = 1,
    model: str = DEFAULT_MODEL,
) -> list[GeneratedQuestion]:
    """Gera `total_questions` perguntas sobre `topic` validadas por Pydantic.

    Levanta `QuizGenerationError` em qualquer falha (parse, validação ou contagem)
    após esgotar `max_retries`.
    """
    if not topic.strip():
        raise QuizGenerationError("topic não pode ser vazio")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": _build_user_prompt(topic, total_questions, subject_name),
        },
    ]

    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.chat(
                messages=messages,
                response_format=RESPONSE_FORMAT,
                model=model,
                temperature=DEFAULT_TEMPERATURE,
            )
            content = _extract_content(response)
            data = json.loads(content)
            parsed = GeneratedQuiz.model_validate(data)
            if len(parsed.questions) != total_questions:
                raise QuizGenerationError(
                    f"OpenAI retornou {len(parsed.questions)} perguntas; "
                    f"esperado {total_questions}"
                )
            return [_shuffle_options(q) for q in parsed.questions]
        except (json.JSONDecodeError, ValidationError, QuizGenerationError) as err:
            last_error = err
            if attempt >= max_retries:
                break

    raise QuizGenerationError(
        f"Falha ao gerar quiz após {max_retries + 1} tentativa(s): {last_error}"
    )
