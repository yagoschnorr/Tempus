from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.study_plan import StudyPlanCreate, StudyPlanResponse, StudyPlanUpdate
from app.services import study_plan_service
from fastapi import status

router = APIRouter()

@router.post("/generate", response_model=StudyPlanResponse, status_code=status.HTTP_201_CREATED)
def generate_study_plan(
    plan_in: StudyPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return study_plan_service.create_study_plan(db, user_id=current_user.id, plan_in=plan_in)

@router.get("", response_model=List[StudyPlanResponse])
def get_study_plans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return study_plan_service.get_study_plans(db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/{plan_id}", response_model=StudyPlanResponse)
def get_study_plan(
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return study_plan_service.get_study_plan(db, plan_id=plan_id, user_id=current_user.id)

@router.patch("/{plan_id}", response_model=StudyPlanResponse)
def update_study_plan(
    plan_id: UUID,
    plan_update: StudyPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return study_plan_service.update_study_plan_status(db, plan_id=plan_id, user_id=current_user.id, plan_update=plan_update)
