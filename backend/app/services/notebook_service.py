"""Serviço de Notebooks e Notes.

Constraints do schema SQL espelhadas em código:
* `notebooks.title VARCHAR(200)` / `notes.title VARCHAR(200)` — validado no schema Pydantic.
* `notes.notebook_id FK notebooks.id ON DELETE CASCADE` — apagar notebook remove
  todas as suas notes automaticamente via banco.
* Ownership: notebooks pertencem ao usuário; notes pertencem ao notebook —
  toda operação em note verifica a cadeia note → notebook → user.
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.notebook import Note, Notebook
from app.models.user import User
from app.schemas.notebook import (
    NotebookCreate,
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
# Notebooks
# ---------------------------------------------------------------------------

def list_user_notebooks(db: Session, user: User) -> List[Notebook]:
    return (
        db.query(Notebook)
        .filter(Notebook.user_id == user.id)
        .order_by(Notebook.created_at.desc())
        .all()
    )


def create_notebook(db: Session, user: User, payload: NotebookCreate) -> Notebook:
    notebook = Notebook(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        color=payload.color,
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return notebook


def get_user_notebook(db: Session, user: User, notebook_id: UUID) -> Notebook:
    return _get_notebook_owned_by_user(db, user.id, notebook_id)


def update_notebook(
    db: Session, user: User, notebook_id: UUID, payload: NotebookUpdate
) -> Notebook:
    notebook = _get_notebook_owned_by_user(db, user.id, notebook_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(notebook, field, value)

    db.commit()
    db.refresh(notebook)
    return notebook


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