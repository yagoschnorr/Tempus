"""Endpoints do Dashboard.

Escopo Sprint 3 (mínimo viável — pendencias.md §7):
  GET /dashboard/realtime → métricas agregadas do dia/semana + streak
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services import progress_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Schema de saída (inline — simples demais para arquivo separado)
# ---------------------------------------------------------------------------

class RealtimeDashboardOut(BaseModel):
    minutes_today: int
    minutes_week: int
    sessions_today: int
    sessions_week: int
    current_streak: int
    avg_quiz_score_week: Optional[float]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/realtime", response_model=RealtimeDashboardOut)
def get_realtime_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = progress_service.get_realtime_dashboard(db, current_user.id)
    return RealtimeDashboardOut(**data)