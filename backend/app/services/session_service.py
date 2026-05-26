from uuid import UUID
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from sqlalchemy.sql import func

from app.models.session import StudySession, SessionStatus
from app.schemas.session import SessionCreate

def create_session(db: Session, user_id: UUID, session_in: SessionCreate) -> StudySession:
    db_session = StudySession(
        user_id=user_id,
        subject_id=session_in.subject_id,
        planned_duration_seconds=session_in.planned_duration_seconds,
        notes=session_in.notes,
        status=SessionStatus.in_progress
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def get_session(db: Session, session_id: UUID, user_id: UUID) -> StudySession:
    db_session = db.query(StudySession).filter(
        StudySession.id == session_id,
        StudySession.user_id == user_id
    ).first()
    
    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    return db_session

def get_sessions(
    db: Session, 
    user_id: UUID, 
    subject_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    skip: int = 0, 
    limit: int = 100
) -> List[StudySession]:
    query = db.query(StudySession).filter(StudySession.user_id == user_id)
    
    if subject_id:
        query = query.filter(StudySession.subject_id == subject_id)
    if from_date:
        query = query.filter(StudySession.started_at >= from_date)
    if to_date:
        query = query.filter(StudySession.started_at <= to_date)
        
    return query.order_by(StudySession.started_at.desc()).offset(skip).limit(limit).all()
