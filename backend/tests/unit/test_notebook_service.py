"""Testes do notebook_service direto contra a sessão (sem TestClient).

Foco do Bloco 1: agregados no `NotebookOut`:
* `notes_count`  — COUNT(notes) por notebook (outer join, então 0 quando vazio).
* `last_activity_at` — GREATEST(notebook.updated_at, MAX(notes.updated_at)).
* Ordenação da listagem segue `last_activity_at desc` (espelha o "Última edição"
  exibido na tela).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _utcnow_naive() -> datetime:
    # SQLite armazena TIMESTAMPTZ sem tzinfo (roundtrip vira naive).
    # Trabalhamos com naive UTC nos testes para evitar comparações inconsistentes.
    return datetime.now(timezone.utc).replace(tzinfo=None)

import pytest
from fastapi import HTTPException

from app.models.notebook import Note, Notebook
from app.models.user import User
from app.schemas.notebook import NotebookCreate, NotebookUpdate
from app.services import notebook_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_notebook(db, user, **overrides) -> Notebook:
    payload = NotebookCreate(**{"title": "Diário de Cálculo", **overrides})
    out = notebook_service.create_notebook(db, user, payload)
    # Retorna a instância ORM para conveniência dos testes que precisam dela
    return db.get(Notebook, out.id)


def _add_note(
    db, notebook: Notebook, *, title: str = "Folha", content: str = "x",
    updated_at: datetime | None = None,
) -> Note:
    note = Note(notebook_id=notebook.id, title=title, content=content)
    db.add(note)
    db.commit()
    db.refresh(note)
    if updated_at is not None:
        note.updated_at = updated_at
        db.commit()
        db.refresh(note)
    return note


# ---------------------------------------------------------------------------
# create_notebook
# ---------------------------------------------------------------------------

def test_create_returns_zero_notes_and_last_activity_equals_updated_at(db, test_user):
    out = notebook_service.create_notebook(
        db, test_user, NotebookCreate(title="Novo")
    )
    assert out.notes_count == 0
    assert out.last_activity_at == out.updated_at


def test_create_persists_defaults(db, test_user):
    out = notebook_service.create_notebook(
        db, test_user, NotebookCreate(title="Novo")
    )
    assert out.color == "#0F6E56"
    assert out.user_id == test_user.id
    assert out.description is None


# ---------------------------------------------------------------------------
# list_user_notebooks — notes_count
# ---------------------------------------------------------------------------

def test_list_empty_when_user_has_no_notebooks(db, test_user):
    assert notebook_service.list_user_notebooks(db, test_user) == []


def test_list_notes_count_is_zero_for_notebook_without_notes(db, test_user):
    _create_notebook(db, test_user, title="Vazio")
    [out] = notebook_service.list_user_notebooks(db, test_user)
    assert out.notes_count == 0


def test_list_notes_count_reflects_added_notes(db, test_user):
    nb = _create_notebook(db, test_user, title="Com folhas")
    _add_note(db, nb)
    _add_note(db, nb)
    _add_note(db, nb)
    [out] = notebook_service.list_user_notebooks(db, test_user)
    assert out.notes_count == 3


def test_list_does_not_leak_other_users_notebooks(db, test_user):
    _create_notebook(db, test_user, title="Meu")

    other = User(name="Outro", email="outro@tempus.dev", password_hash="x")
    db.add(other)
    db.commit()
    db.refresh(other)
    notebook_service.create_notebook(db, other, NotebookCreate(title="Do outro"))

    outs = notebook_service.list_user_notebooks(db, test_user)
    assert len(outs) == 1
    assert outs[0].title == "Meu"


# ---------------------------------------------------------------------------
# list_user_notebooks — last_activity_at
# ---------------------------------------------------------------------------

def test_last_activity_falls_back_to_notebook_updated_at_when_no_notes(db, test_user):
    nb = _create_notebook(db, test_user, title="Sem folhas")
    [out] = notebook_service.list_user_notebooks(db, test_user)
    assert out.last_activity_at == nb.updated_at


def test_last_activity_uses_max_note_updated_at_when_newer(db, test_user):
    nb = _create_notebook(db, test_user, title="Folha nova")
    future = _utcnow_naive() + timedelta(days=1)
    _add_note(db, nb, updated_at=future)

    [out] = notebook_service.list_user_notebooks(db, test_user)
    assert out.last_activity_at == future


def test_last_activity_keeps_notebook_updated_at_when_notes_are_older(db, test_user):
    nb = _create_notebook(db, test_user, title="Notebook mais novo")
    past = _utcnow_naive() - timedelta(days=10)
    _add_note(db, nb, updated_at=past)

    [out] = notebook_service.list_user_notebooks(db, test_user)
    assert out.last_activity_at == nb.updated_at


# ---------------------------------------------------------------------------
# list_user_notebooks — ordenação
# ---------------------------------------------------------------------------

def test_list_orders_by_last_activity_desc(db, test_user):
    nb_old = _create_notebook(db, test_user, title="Antigo")
    nb_new = _create_notebook(db, test_user, title="Recente")

    now = _utcnow_naive()
    _add_note(db, nb_old, updated_at=now - timedelta(days=5))
    _add_note(db, nb_new, updated_at=now + timedelta(days=1))

    outs = notebook_service.list_user_notebooks(db, test_user)
    assert [o.title for o in outs] == ["Recente", "Antigo"]


# ---------------------------------------------------------------------------
# update_notebook
# ---------------------------------------------------------------------------

def test_update_returns_aggregates_recomputed(db, test_user):
    nb = _create_notebook(db, test_user, title="Original")
    _add_note(db, nb)
    _add_note(db, nb)

    out = notebook_service.update_notebook(
        db, test_user, nb.id, NotebookUpdate(title="Editado")
    )
    assert out.title == "Editado"
    assert out.notes_count == 2


# ---------------------------------------------------------------------------
# pinned (Bloco 2)
# ---------------------------------------------------------------------------

def test_create_default_pinned_is_false(db, test_user):
    out = notebook_service.create_notebook(
        db, test_user, NotebookCreate(title="Novo")
    )
    assert out.pinned is False


def test_update_can_pin_notebook(db, test_user):
    nb = _create_notebook(db, test_user, title="Para fixar")
    out = notebook_service.update_notebook(
        db, test_user, nb.id, NotebookUpdate(pinned=True)
    )
    assert out.pinned is True


def test_update_can_unpin_notebook(db, test_user):
    nb = _create_notebook(db, test_user, title="Já fixado")
    nb.pinned = True
    db.commit()

    out = notebook_service.update_notebook(
        db, test_user, nb.id, NotebookUpdate(pinned=False)
    )
    assert out.pinned is False


def test_list_orders_pinned_first_then_by_last_activity(db, test_user):
    # Cenário: 3 notebooks — 1 fixado antigo, 1 não-fixado recente, 1 não-fixado antigo.
    # Esperado: fixado primeiro mesmo sendo o mais antigo, depois os outros por atividade desc.
    nb_pinned_old = _create_notebook(db, test_user, title="Fixado antigo")
    nb_pinned_old.pinned = True
    db.commit()

    nb_recent = _create_notebook(db, test_user, title="Recente")
    nb_old = _create_notebook(db, test_user, title="Antigo")

    now = _utcnow_naive()
    _add_note(db, nb_pinned_old, updated_at=now - timedelta(days=10))
    _add_note(db, nb_recent, updated_at=now)
    _add_note(db, nb_old, updated_at=now - timedelta(days=5))

    outs = notebook_service.list_user_notebooks(db, test_user)
    assert [o.title for o in outs] == ["Fixado antigo", "Recente", "Antigo"]


def test_update_404_when_not_owner(db, test_user):
    other = User(name="Outro", email="outro2@tempus.dev", password_hash="x")
    db.add(other)
    db.commit()
    db.refresh(other)
    foreign = notebook_service.create_notebook(
        db, other, NotebookCreate(title="Alheio")
    )

    with pytest.raises(HTTPException) as exc:
        notebook_service.update_notebook(
            db, test_user, foreign.id, NotebookUpdate(title="Hack")
        )
    assert exc.value.status_code == 404
