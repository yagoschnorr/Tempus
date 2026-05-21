"""Endpoints REST do módulo de Notebooks e Notes.

Contrato (ultraplan §3 — Notebooks + Notes / Alberto — Sprint 3, dia 1-2):

Notebooks:
  GET    /notebooks                    → lista de notebooks do usuário
  POST   /notebooks                    → criar notebook
  PATCH  /notebooks/{notebook_id}      → editar título/descrição/cor
  DELETE /notebooks/{notebook_id}      → remover (CASCADE em notes)

Notes:
  GET    /notebooks/{notebook_id}/notes          → lista de notes do notebook
  POST   /notebooks/{notebook_id}/notes          → criar note
  PATCH  /notes/{note_id}                        → editar título/conteúdo
  DELETE /notes/{note_id}                        → remover note
  POST   /notes/{note_id}/summary                → resumo via IA (análogo ao
                                                   summary de documento)
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.integrations.openai_client import OpenAIClient, get_openai
from app.models.notebook import Note, Notebook
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

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_notebook_or_404(db: Session, user: User, notebook_id: UUID) -> Notebook:
    notebook = (
        db.query(Notebook)
        .filter(Notebook.id == notebook_id, Notebook.user_id == user.id)
        .first()
    )
    if not notebook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notebook não encontrado",
        )
    return notebook


def _get_note_or_404(db: Session, user: User, note_id: UUID) -> Note:
    """Busca a note garantindo que pertence ao usuário via JOIN com notebooks."""
    note = (
        db.query(Note)
        .join(Notebook, Note.notebook_id == Notebook.id)
        .filter(Note.id == note_id, Notebook.user_id == user.id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note não encontrada",
        )
    return note


# ---------------------------------------------------------------------------
# Notebooks
# ---------------------------------------------------------------------------

@router.get("", response_model=List[NotebookOut])
def list_notebooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Notebook)
        .filter(Notebook.user_id == current_user.id)
        .order_by(Notebook.created_at.desc())
        .all()
    )


@router.post("", response_model=NotebookOut, status_code=status.HTTP_201_CREATED)
def create_notebook(
    payload: NotebookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notebook = Notebook(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        color=payload.color,
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return notebook


@router.patch("/{notebook_id}", response_model=NotebookOut)
def update_notebook(
    notebook_id: UUID,
    payload: NotebookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notebook = _get_notebook_or_404(db, current_user, notebook_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(notebook, field, value)

    db.commit()
    db.refresh(notebook)
    return notebook


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notebook(
    notebook_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notebook = _get_notebook_or_404(db, current_user, notebook_id)
    db.delete(notebook)
    db.commit()
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
    # Garante que o notebook pertence ao usuário antes de listar
    _get_notebook_or_404(db, current_user, notebook_id)

    return (
        db.query(Note)
        .filter(Note.notebook_id == notebook_id)
        .order_by(Note.updated_at.desc())
        .all()
    )


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
    _get_notebook_or_404(db, current_user, notebook_id)

    note = Note(
        notebook_id=notebook_id,
        title=payload.title,
        content=payload.content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = _get_note_or_404(db, current_user, note_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = _get_note_or_404(db, current_user, note_id)
    db.delete(note)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# IA: resumo de note  (análogo ao POST /documents/{id}/summary)
# ---------------------------------------------------------------------------

_SUMMARY_SYSTEM = (
    "Você é um assistente acadêmico. Dado o conteúdo de uma nota de estudos, "
    "produza um resumo claro e conciso em português do Brasil, "
    "destacando os pontos principais em no máximo 5 frases."
)


@router.post("/notes/{note_id}/summary", response_model=NoteSummaryOut)
def summarize_note(
    note_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    openai: OpenAIClient = Depends(get_openai),
):
    note = _get_note_or_404(db, current_user, note_id)

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