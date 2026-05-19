"""Testes do subject_service direto contra a sessão (sem TestClient).

Inclui o teste crítico do `ON DELETE SET NULL` em `documents`: ao deletar uma
matéria, qualquer documento que apontava para ela continua existindo, mas com
`subject_id = NULL`.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.models.document import Document, DocumentStatus
from app.models.subject import Subject
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectUpdate
from app.services import subject_service


def _create(db, user, **overrides) -> Subject:
    payload = SubjectCreate(**{"name": "Cálculo I", **overrides})
    return subject_service.create_subject(db, user, payload)


def test_create_persists_with_defaults(db, test_user):
    s = _create(db, test_user)
    assert s.id is not None
    assert s.color == "#534AB7"
    assert s.weekly_goal_minutes == 0
    assert s.user_id == test_user.id


def test_create_uses_provided_color_and_goal(db, test_user):
    s = _create(db, test_user, color="#a855f7", weekly_goal_minutes=600)
    assert s.color == "#a855f7"
    assert s.weekly_goal_minutes == 600


def test_create_rejects_duplicate_name_for_same_user(db, test_user):
    _create(db, test_user, name="Cálculo I")
    with pytest.raises(HTTPException) as exc:
        _create(db, test_user, name="Cálculo I")
    assert exc.value.status_code == 409


def test_same_name_allowed_across_different_users(db, test_user):
    _create(db, test_user, name="Cálculo I")

    other = User(name="Other", email="other@tempus.dev", password_hash="x")
    db.add(other)
    db.commit()
    db.refresh(other)

    other_subject = subject_service.create_subject(
        db, other, SubjectCreate(name="Cálculo I")
    )
    assert other_subject.id is not None


def test_list_returns_only_user_subjects(db, test_user):
    _create(db, test_user, name="A")
    _create(db, test_user, name="B")

    other = User(name="Other", email="other2@tempus.dev", password_hash="x")
    db.add(other)
    db.commit()
    db.refresh(other)
    subject_service.create_subject(db, other, SubjectCreate(name="C"))

    names = {s.name for s in subject_service.list_user_subjects(db, test_user)}
    assert names == {"A", "B"}


def test_get_missing_returns_404(db, test_user):
    import uuid

    with pytest.raises(HTTPException) as exc:
        subject_service.get_user_subject(db, test_user, uuid.uuid4())
    assert exc.value.status_code == 404


def test_update_partial_fields(db, test_user):
    s = _create(db, test_user)
    updated = subject_service.update_subject(
        db, test_user, s.id, SubjectUpdate(weekly_goal_minutes=300)
    )
    assert updated.name == "Cálculo I"
    assert updated.weekly_goal_minutes == 300


def test_update_to_existing_name_returns_409(db, test_user):
    _create(db, test_user, name="A")
    b = _create(db, test_user, name="B")
    with pytest.raises(HTTPException) as exc:
        subject_service.update_subject(
            db, test_user, b.id, SubjectUpdate(name="A")
        )
    assert exc.value.status_code == 409


def test_update_to_same_name_is_idempotent(db, test_user):
    s = _create(db, test_user, name="Cálculo I")
    updated = subject_service.update_subject(
        db, test_user, s.id, SubjectUpdate(name="Cálculo I", weekly_goal_minutes=120)
    )
    assert updated.name == "Cálculo I"
    assert updated.weekly_goal_minutes == 120


def test_delete_removes_subject(db, test_user):
    s = _create(db, test_user)
    subject_service.delete_subject(db, test_user, s.id)
    assert db.query(Subject).filter(Subject.id == s.id).first() is None


def test_delete_orphans_documents_without_cascading(db, test_user):
    """Critical: deletar matéria DEIXA o documento existir com subject_id=NULL."""
    s = _create(db, test_user)
    doc = Document(
        user_id=test_user.id,
        subject_id=s.id,
        filename="apostila.pdf",
        file_path=f"uploads/{test_user.id}/dummy.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        total_chunks=0,
        status=DocumentStatus.processing,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    doc_id = doc.id

    subject_service.delete_subject(db, test_user, s.id)

    # SQLite com o create_all pega o ondelete="SET NULL" do model
    db.expire_all()
    survivor = db.query(Document).filter(Document.id == doc_id).first()
    assert survivor is not None, "documento foi apagado por engano (cascade)"
    assert survivor.subject_id is None, "subject_id deveria ter virado NULL"
