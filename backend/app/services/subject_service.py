"""Serviço de CRUD de matérias.

Constraints do schema SQL espelhadas em código:
* `UNIQUE (user_id, name)` → `_name_taken` faz SELECT prévio para retornar 409
  limpo em vez de deixar o `IntegrityError` virar 500.
* Hard delete: SQL faz `ON DELETE SET NULL` em documents/quizzes/sessions, então
  apagar a matéria deixa esses registros órfãos (não cascateia).
"""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.subject import Subject
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectUpdate

DEFAULT_COLOR = "#534AB7"  # bate com o SQL default em subjects.color


def _name_taken(
    db: Session,
    user_id: UUID,
    name: str,
    exclude_id: Optional[UUID] = None,
) -> bool:
    query = db.query(Subject).filter(
        Subject.user_id == user_id, Subject.name == name
    )
    if exclude_id is not None:
        query = query.filter(Subject.id != exclude_id)
    return query.first() is not None


def _get_subject_owned_by_user(
    db: Session, user_id: UUID, subject_id: UUID
) -> Subject:
    subject = (
        db.query(Subject)
        .filter(Subject.id == subject_id, Subject.user_id == user_id)
        .first()
    )
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Matéria não encontrada"
        )
    return subject


def create_subject(db: Session, user: User, payload: SubjectCreate) -> Subject:
    if _name_taken(db, user.id, payload.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma matéria com esse nome",
        )
    subject = Subject(
        user_id=user.id,
        name=payload.name,
        color=payload.color or DEFAULT_COLOR,
        description=payload.description,
        weekly_goal_minutes=payload.weekly_goal_minutes or 0,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def list_user_subjects(db: Session, user: User) -> List[Subject]:
    return (
        db.query(Subject)
        .filter(Subject.user_id == user.id)
        .order_by(Subject.created_at.desc())
        .all()
    )


def get_user_subject(db: Session, user: User, subject_id: UUID) -> Subject:
    return _get_subject_owned_by_user(db, user.id, subject_id)


def update_subject(
    db: Session, user: User, subject_id: UUID, payload: SubjectUpdate
) -> Subject:
    subject = _get_subject_owned_by_user(db, user.id, subject_id)

    updates = payload.model_dump(exclude_unset=True)

    new_name = updates.get("name")
    if new_name is not None and new_name != subject.name:
        if _name_taken(db, user.id, new_name, exclude_id=subject_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe uma matéria com esse nome",
            )

    for field, value in updates.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)
    return subject


def delete_subject(db: Session, user: User, subject_id: UUID) -> None:
    subject = _get_subject_owned_by_user(db, user.id, subject_id)
    db.delete(subject)
    db.commit()
