from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.session import SessionComplete, SessionCreate, SessionResponse
from app.services import session_service
from app.models.session import SessionStatus
from sqlalchemy.sql import func
from fastapi import HTTPException, status

router = APIRouter()

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return session_service.create_session(db, user_id=current_user.id, session_in=session_in)

@router.get("", response_model=List[SessionResponse])
def get_sessions(
    subject_id: Optional[UUID] = Query(None, description="Filtra por matéria"),
    from_date: Optional[datetime] = Query(None, alias="from", description="Data de início (ex: 2026-05-01T00:00:00Z)"),
    to_date: Optional[datetime] = Query(None, alias="to", description="Data de fim"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return session_service.get_sessions(
        db, 
        user_id=current_user.id, 
        subject_id=subject_id,
        from_date=from_date,
        to_date=to_date,
        skip=skip, 
        limit=limit
    )

@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return session_service.get_session(db, session_id=session_id, user_id=current_user.id)

@router.patch("/{session_id}/complete", response_model=SessionResponse)
def complete_session(
    session_id: UUID,
    payload: Optional[SessionComplete] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_session = session_service.get_session(db, session_id=session_id, user_id=current_user.id)
    if db_session.status == SessionStatus.completed:
        raise HTTPException(status_code=400, detail="Session is already completed")
    db_session.status = SessionStatus.completed
    db_session.ended_at = func.now()
    if payload is not None:
        db_session.actual_duration_seconds = payload.actual_duration_seconds
        db_session.pause_duration_seconds = payload.pause_duration_seconds
        if payload.notes is not None:
            db_session.notes = payload.notes
    else:
        # Fallback retrocompatível para clientes que ainda não enviam tempos.
        db_session.actual_duration_seconds = db_session.planned_duration_seconds
    db.commit()
    db.refresh(db_session)
    return db_session

@router.patch("/{session_id}/pause", response_model=SessionResponse)
def pause_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_session = session_service.get_session(db, session_id=session_id, user_id=current_user.id)
    db_session.status = SessionStatus.paused
    db.commit()
    db.refresh(db_session)
    return db_session

@router.patch("/{session_id}/resume", response_model=SessionResponse)
def resume_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_session = session_service.get_session(db, session_id=session_id, user_id=current_user.id)
    db_session.status = SessionStatus.in_progress
    db.commit()
    db.refresh(db_session)
    return db_session

@router.patch("/{session_id}/abandon", response_model=SessionResponse)
def abandon_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_session = session_service.get_session(db, session_id=session_id, user_id=current_user.id)
    db_session.status = SessionStatus.abandoned
    db_session.ended_at = func.now()
    db.commit()
    db.refresh(db_session)
    return db_session
