"""Serviço de Notebooks e Notes.

Constraints do schema SQL espelhadas em código:
* `notebooks.title VARCHAR(200)` / `notes.title VARCHAR(200)` — validado no schema Pydantic.
* `notes.notebook_id FK notebooks.id ON DELETE CASCADE` — apagar notebook remove
  todas as suas notes automaticamente via banco.
* Ownership: notebooks pertencem ao usuário; notes pertencem ao notebook —
  toda operação em note verifica a cadeia note → notebook → user.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notebook import Note, Notebook
from app.models.user import User
from app.schemas.notebook import (
    NotebookCreate,
    NotebookOut,
    NotebookUpdate,
    NoteCreate,
    NoteUpdate,
)


# ---------------------------------------------------------------------------
# Helpers privados
# ---------------------------------------------------------------------------

def _get_notebook_owned_by_user(
    db: Session, user_id: UUID, notebook_id: UUID
) -> Notebook:
    notebook = (
        db.query(Notebook)
        .filter(Notebook.id == notebook_id, Notebook.user_id == user_id)
        .first()
    )
    if notebook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notebook não encontrado",
        )
    return notebook


def _get_note_owned_by_user(
    db: Session, user_id: UUID, note_id: UUID
) -> Note:
    """Busca a note garantindo a cadeia note → notebook → user."""
    note = (
        db.query(Note)
        .join(Notebook, Note.notebook_id == Notebook.id)
        .filter(Note.id == note_id, Notebook.user_id == user_id)
        .first()
    )
    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note não encontrada",
        )
    return note


# ---------------------------------------------------------------------------
# Aggregates — notes_count + last_activity_at
# ---------------------------------------------------------------------------
# SQLite não suporta GREATEST(); calculamos o máximo em Python a partir do
# MAX(notes.updated_at) agregado e do `notebook.updated_at` carregado.

def _to_notebook_out(
    notebook: Notebook,
    notes_count: int,
    max_note_updated_at: Optional[datetime],
) -> NotebookOut:
    last_activity = notebook.updated_at
    if max_note_updated_at is not None and max_note_updated_at > last_activity:
        last_activity = max_note_updated_at
    return NotebookOut(
        id=notebook.id,
        user_id=notebook.user_id,
        title=notebook.title,
        description=notebook.description,
        color=notebook.color,
        pinned=notebook.pinned,
        notes_count=notes_count,
        last_activity_at=last_activity,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )


def _get_notebook_aggregates(
    db: Session, notebook_id: UUID
) -> tuple[int, Optional[datetime]]:
    row = (
        db.query(func.count(Note.id), func.max(Note.updated_at))
        .filter(Note.notebook_id == notebook_id)
        .one()
    )
    return int(row[0] or 0), row[1]


# ---------------------------------------------------------------------------
# Notebooks
# ---------------------------------------------------------------------------

def list_user_notebooks(db: Session, user: User) -> List[NotebookOut]:
    notes_count_col = func.count(Note.id).label("notes_count")
    max_note_updated_col = func.max(Note.updated_at).label("max_note_updated_at")

    rows = (
        db.query(Notebook, notes_count_col, max_note_updated_col)
        .outerjoin(Note, Note.notebook_id == Notebook.id)
        .filter(Notebook.user_id == user.id)
        .group_by(Notebook.id)
        .all()
    )

    outs = [_to_notebook_out(nb, count, max_at) for nb, count, max_at in rows]
    # Fixados primeiro; dentro de cada grupo, ordena por última atividade desc.
    # Tupla `(pinned, last_activity_at)` em ordem descendente coloca True (fixado)
    # antes de False e dates novas antes das antigas.
    outs.sort(key=lambda o: (o.pinned, o.last_activity_at), reverse=True)
    return outs


def create_notebook(db: Session, user: User, payload: NotebookCreate) -> NotebookOut:
    notebook = Notebook(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        color=payload.color,
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return _to_notebook_out(notebook, notes_count=0, max_note_updated_at=None)


def get_user_notebook(db: Session, user: User, notebook_id: UUID) -> Notebook:
    return _get_notebook_owned_by_user(db, user.id, notebook_id)


def update_notebook(
    db: Session, user: User, notebook_id: UUID, payload: NotebookUpdate
) -> NotebookOut:
    notebook = _get_notebook_owned_by_user(db, user.id, notebook_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(notebook, field, value)

    db.commit()
    db.refresh(notebook)

    notes_count, max_note_updated_at = _get_notebook_aggregates(db, notebook_id)
    return _to_notebook_out(notebook, notes_count, max_note_updated_at)


def delete_notebook(db: Session, user: User, notebook_id: UUID) -> None:
    """Remove o notebook. Notes somem por CASCADE."""
    notebook = _get_notebook_owned_by_user(db, user.id, notebook_id)
    db.delete(notebook)
    db.commit()


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

def list_notebook_notes(
    db: Session, user: User, notebook_id: UUID
) -> List[Note]:
    # Garante que o notebook pertence ao usuário antes de listar
    _get_notebook_owned_by_user(db, user.id, notebook_id)
    return (
        db.query(Note)
        .filter(Note.notebook_id == notebook_id)
        .order_by(Note.updated_at.desc())
        .all()
    )


def create_note(
    db: Session, user: User, notebook_id: UUID, payload: NoteCreate
) -> Note:
    _get_notebook_owned_by_user(db, user.id, notebook_id)

    note = Note(
        notebook_id=notebook_id,
        title=payload.title,
        content=payload.content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def get_user_note(db: Session, user: User, note_id: UUID) -> Note:
    return _get_note_owned_by_user(db, user.id, note_id)


def update_note(
    db: Session, user: User, note_id: UUID, payload: NoteUpdate
) -> Note:
    note = _get_note_owned_by_user(db, user.id, note_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, user: User, note_id: UUID) -> None:
    note = _get_note_owned_by_user(db, user.id, note_id)
    db.delete(note)
    db.commit()