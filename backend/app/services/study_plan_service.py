from uuid import UUID
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.study_plan import StudyPlan, StudyPlanSubject, StudyPlanStatus
from app.schemas.study_plan import StudyPlanCreate, StudyPlanUpdate

def generate_plan_mock(plan_in: StudyPlanCreate) -> str:
    """Mock determinístico que simula um plano de estudos gerado por IA."""
    lines = [
        f"# Plano de Estudos: {plan_in.title}",
        f"**Horas diárias disponíveis:** {plan_in.daily_hours_available}h",
        f"**Data da Prova/Exame:** {plan_in.exam_date.strftime('%Y-%m-%d') if plan_in.exam_date else 'Não definida'}",
        "",
        "## Divisão de Matérias Sugerida",
        "*(Plano gerado de forma determinística - Fallback MVP)*",
        ""
    ]
    
    for sub in plan_in.subjects:
        if sub.priority.value == "high":
            peso = "Alta **(Prioridade Máxima)**"
        elif sub.priority.value == "medium":
            peso = "Média"
        else:
            peso = "Baixa"
        
        lines.append(f"- Matéria ID `{sub.subject_id}`: Nível {peso}")
        
    lines.append("")
    lines.append("### Estratégia de Estudos Aconselhada:")
    lines.append("1. Foque nas matérias de alta prioridade nos horários em que você rende mais.")
    lines.append("2. Utilize a técnica Pomodoro para sessões intensas com pausas programadas.")
    lines.append("3. Reserve os finais de semana para realizar Quizzes e testar seu desempenho nestas matérias.")
    
    return "\n".join(lines)


def _attach_subjects(db: Session, plan: StudyPlan) -> StudyPlan:
    """Helper para injetar a lista de referências subjects e o schema do response ler corretamente."""
    if plan:
        subs = db.query(StudyPlanSubject).filter(StudyPlanSubject.study_plan_id == plan.id).all()
        # O setattr aqui garante que ele seja compatível com a propriedade model_config(from_attributes=True) do Pydantic
        setattr(plan, "subjects", subs)
    return plan


def create_study_plan(db: Session, user_id: UUID, plan_in: StudyPlanCreate) -> StudyPlan:
    content = generate_plan_mock(plan_in)
    
    db_plan = StudyPlan(
        user_id=user_id,
        title=plan_in.title,
        exam_date=plan_in.exam_date,
        daily_hours_available=plan_in.daily_hours_available,
        plan_content=content,
        status=StudyPlanStatus.active
    )
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    subjects_db = []
    for sub in plan_in.subjects:
        db_sub = StudyPlanSubject(
            study_plan_id=db_plan.id,
            subject_id=sub.subject_id,
            priority=sub.priority
        )
        db.add(db_sub)
        subjects_db.append(db_sub)
        
    db.commit()
    db.refresh(db_plan)
    
    return _attach_subjects(db, db_plan)


def get_study_plans(db: Session, user_id: UUID, skip: int = 0, limit: int = 100) -> List[StudyPlan]:
    plans = db.query(StudyPlan).filter(StudyPlan.user_id == user_id).order_by(StudyPlan.created_at.desc()).offset(skip).limit(limit).all()
    for p in plans:
        _attach_subjects(db, p)
    return plans


def get_study_plan(db: Session, plan_id: UUID, user_id: UUID) -> StudyPlan:
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id, StudyPlan.user_id == user_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study plan not found")
    return _attach_subjects(db, plan)


def update_study_plan_status(db: Session, plan_id: UUID, user_id: UUID, plan_update: StudyPlanUpdate) -> StudyPlan:
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id, StudyPlan.user_id == user_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study plan not found")
        
    plan.status = plan_update.status
    db.commit()
    db.refresh(plan)
    return _attach_subjects(db, plan)
