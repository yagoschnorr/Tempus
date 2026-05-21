"""Endpoints REST do módulo de Notebooks e Notes.

Contrato (ultraplan §3 — Notebooks + Notes / Alberto — Sprint 3, dia 1-2):

Notebooks:
  GET    /notebooks                          → lista de notebooks do usuário
  POST   /notebooks                          → criar notebook
  PATCH  /notebooks/{notebook_id}            → editar título/descrição/cor
  DELETE /notebooks/{notebook_id}            → remover (CASCADE em notes)

Notes:
  GET    /notebooks/{notebook_id}/notes      → lista de notes do notebook
  POST   /notebooks/{notebook_id}/notes      → criar note
  PATCH  /notebooks/notes/{note_id}          → editar título/conteúdo
  DELETE /notebooks/notes/{note_id}          → remover note
  POST   /notebooks/notes/{note_id}/summary  → resumo via IA
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.integrations.openai_client import OpenAIClient, get_openai
from app.models.user import User
from app.schemas.notebook import (
    NotebookCreate,
    NotebookOut,
    NotebookUpdate,
    NoteCreate,
    NoteOut,
    NoteSummaryOut,
    NoteUpdate,
)
from app.services import notebook_service

router = APIRouter()

_SUMMARY_SYSTEM = (
    "Você é um assistente acadêmico. Dado o conteúdo de uma nota de estudos, "
    "produza um resumo claro e conciso em português do Brasil, "
    "destacando os pontos principais em no máximo 5 frases."
)


# ---------------------------------------------------------------------------
# Notebooks
# ---------------------------------------------------------------------------

@router.get("", response_model=List[NotebookOut])
def list_notebooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notebook_service.list_user_notebooks(db, current_user)


@router.post("", response_model=NotebookOut, status_code=status.HTTP_201_CREATED)
def create_notebook(
    payload: NotebookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notebook_service.create_notebook(db, current_user, payload)


@router.patch("/{notebook_id}", response_model=NotebookOut)
def update_notebook(
    notebook_id: UUID,
    payload: NotebookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notebook_service.update_notebook(db, current_user, notebook_id, payload)


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook(
    notebook_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notebook_service.delete_notebook(db, current_user, notebook_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

@router.get("/{notebook_id}/notes", response_model=List[NoteOut])
def list_notes(
    notebook_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notebook_service.list_notebook_notes(db, current_user, notebook_id)


@router.post(
    "/{notebook_id}/notes",
    response_model=NoteOut,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
    notebook_id: UUID,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notebook_service.create_note(db, current_user, notebook_id, payload)


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notebook_service.update_note(db, current_user, note_id, payload)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notebook_service.delete_note(db, current_user, note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# IA: resumo de note
# ---------------------------------------------------------------------------

@router.post("/notes/{note_id}/summary", response_model=NoteSummaryOut)
def summarize_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    openai: OpenAIClient = Depends(get_openai),
):
    note = notebook_service.get_user_note(db, current_user, note_id)

    if not note.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A note está vazia; adicione conteúdo antes de gerar o resumo.",
        )

    messages = [
        {"role": "system", "content": _SUMMARY_SYSTEM},
        {"role": "user", "content": note.content},
    ]
    response = openai.chat(messages=messages, model="gpt-4o-mini")

    try:
        summary_text = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resposta inesperada da IA: {err}",
        )

    return NoteSummaryOut(summary=summary_text)