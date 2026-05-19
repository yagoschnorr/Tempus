"""Endpoints REST do CRUD de matérias.

Contrato espelha `frontend-atual/src/lib/mocks/handlers.ts` (subjectsHandlers):
* `GET    /`           → 200 + lista
* `POST   /`           → 201 + Subject (409 em nome duplicado)
* `GET    /{id}`       → 200 / 404
* `PATCH  /{id}`       → 200 / 404 / 409
* `DELETE /{id}`       → 204 / 404
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate
from app.services import subject_service

router = APIRouter()


@router.get("", response_model=List[SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return subject_service.list_user_subjects(db, current_user)


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return subject_service.create_subject(db, current_user, payload)


@router.get("/{subject_id}", response_model=SubjectOut)
def get_subject(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return subject_service.get_user_subject(db, current_user, subject_id)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: UUID,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return subject_service.update_subject(db, current_user, subject_id, payload)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subject_service.delete_subject(db, current_user, subject_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
