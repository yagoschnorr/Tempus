from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from app.models.study_plan import StudyPlanStatus, StudyPlanPriority

class StudyPlanSubjectCreate(BaseModel):
    subject_id: UUID
    priority: StudyPlanPriority = StudyPlanPriority.medium

class StudyPlanSubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    subject_id: UUID
    priority: StudyPlanPriority

class StudyPlanBase(BaseModel):
    title: str
    exam_date: Optional[date] = None
    daily_hours_available: float

class StudyPlanCreate(StudyPlanBase):
    subjects: List[StudyPlanSubjectCreate]

class StudyPlanUpdate(BaseModel):
    status: StudyPlanStatus

class StudyPlanResponse(StudyPlanBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    user_id: UUID
    plan_content: str
    status: StudyPlanStatus
    generated_at: datetime
    created_at: datetime
    subjects: List[StudyPlanSubjectResponse] = []
