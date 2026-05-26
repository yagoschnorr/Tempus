import logging
from uuid import UUID
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.integrations.openai_client import OpenAIClient
from app.models.study_plan import StudyPlan, StudyPlanSubject, StudyPlanStatus
from app.models.subject import Subject
from app.schemas.study_plan import StudyPlanCreate, StudyPlanUpdate

logger = logging.getLogger(__name__)

_PRIORITY_PT = {"low": "baixa", "medium": "média", "high": "alta"}

def _build_ai_prompts(
    plan_in: StudyPlanCreate,
    subject_names: dict[UUID, str],
) -> tuple[str, str]:
    materias_lines = []
    for sub in plan_in.subjects:
        name = subject_names.get(sub.subject_id, "Matéria sem nome")
        materias_lines.append(
            f"- {name} (prioridade {_PRIORITY_PT[sub.priority.value]})"
        )

    exam_str = (
        plan_in.exam_date.strftime("%d/%m/%Y")
        if plan_in.exam_date
        else "não definida"
    )

    system_prompt = (
        "Você é um coach de estudos especialista em planejamento. Sua resposta deve:\n"
        "- Estar inteiramente em português do Brasil.\n"
        "- Ser em markdown bem formatado (títulos com #, listas com -, ênfases com **).\n"
        "- Ser específica ao input fornecido (nunca genérica).\n"
        "- Ter no máximo 600 palavras."
    )

    user_prompt = (
        f"Crie um plano de estudos personalizado para o seguinte estudante:\n\n"
        f"**Título do plano:** {plan_in.title}\n"
        f"**Horas disponíveis por dia:** {plan_in.daily_hours_available}h\n"
        f"**Data da prova/exame:** {exam_str}\n\n"
        f"**Matérias a estudar:**\n"
        f"{chr(10).join(materias_lines)}\n\n"
        "Estruture o plano em markdown com seções claras:\n"
        "1. Visão geral (1-2 parágrafos sobre a estratégia macro)\n"
        "2. Distribuição das horas por matéria (considerando prioridade e tempo até a prova)\n"
        "3. Cronograma sugerido (por dia da semana ou por bloco semanal)\n"
        "4. Dicas específicas para esse perfil (técnicas de estudo, ordem de revisão)\n\n"
        "Seja prático e específico — referencie as matérias pelo nome. Não use placeholders genéricos."
    )

    return system_prompt, user_prompt


def generate_plan_with_ai(
    client: OpenAIClient,
    plan_in: StudyPlanCreate,
    subject_names: dict[UUID, str],
) -> str:
    """Gera o plano via OpenAI em markdown. Levanta ValueError se a resposta for inutilizável."""
    system_prompt, user_prompt = _build_ai_prompts(plan_in, subject_names)

    response = client.chat(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
    )

    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as err:
        raise ValueError(f"Estrutura inesperada da resposta da IA: {err}")

    if not content or len(content.strip()) < 50:
        raise ValueError("Resposta vazia ou curta demais")

    return content.strip()


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


def create_study_plan(
    db: Session,
    user_id: UUID,
    plan_in: StudyPlanCreate,
    openai: OpenAIClient,
) -> StudyPlan:
    # Resolve nomes das matérias para alimentar o prompt da IA. Falha aqui é
    # tratada como "matéria sem nome" no prompt — não bloqueia geração.
    subject_ids = [s.subject_id for s in plan_in.subjects]
    subjects_db = (
        db.query(Subject)
        .filter(Subject.id.in_(subject_ids), Subject.user_id == user_id)
        .all()
    )
    subject_names = {s.id: s.name for s in subjects_db}

    try:
        content = generate_plan_with_ai(openai, plan_in, subject_names)
    except Exception as err:
        logger.warning(
            "IA falhou ao gerar plano (%s); usando fallback determinístico", err
        )
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
