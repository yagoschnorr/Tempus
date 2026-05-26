"""Serviço de progresso e dashboard.

Escopo Sprint 3 (mínimo viável — pendencias.md §7):
  * `get_realtime_dashboard` → agrega sessões completadas do dia/semana + streak.

Queries diretas com SQLAlchemy core (sem ORM eager loading) para manter
as agregações simples e evitar N+1.

Definições:
  * "hoje"        → desde 00:00 UTC do dia corrente até agora.
  * "esta semana" → últimos 7 dias corridos (inclusive hoje).
  * "streak"      → dias consecutivos com pelo menos 1 sessão completada,
                    contados regressivamente a partir de hoje.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.session import SessionStatus, StudySession
from app.models.quiz import Quiz, QuizStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _start_of_day(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _minutes_studied(
    db: Session,
    user_id: UUID,
    since: datetime,
    until: Optional[datetime] = None,
) -> int:
    """Soma `actual_duration_seconds` de sessões completadas no intervalo."""
    until = until or datetime.now(timezone.utc)
    result = (
        db.query(func.coalesce(func.sum(StudySession.actual_duration_seconds), 0))
        .filter(
            StudySession.user_id == user_id,
            StudySession.status == SessionStatus.completed,
            StudySession.ended_at >= since,
            StudySession.ended_at < until,
        )
        .scalar()
    )
    return int(result) // 60


def _sessions_count(
    db: Session,
    user_id: UUID,
    since: datetime,
    until: Optional[datetime] = None,
) -> int:
    until = until or datetime.now(timezone.utc)
    return (
        db.query(StudySession)
        .filter(
            StudySession.user_id == user_id,
            StudySession.status == SessionStatus.completed,
            StudySession.ended_at >= since,
            StudySession.ended_at < until,
        )
        .count()
    )


def _current_streak(db: Session, user_id: UUID) -> int:
    """Dias consecutivos com pelo menos 1 sessão completada, até hoje."""
    today = _today_utc()
    streak = 0
    cursor = today

    while True:
        day_start = _start_of_day(cursor)
        day_end = day_start + timedelta(days=1)

        has_session = (
            db.query(StudySession)
            .filter(
                StudySession.user_id == user_id,
                StudySession.status == SessionStatus.completed,
                StudySession.ended_at >= day_start,
                StudySession.ended_at < day_end,
            )
            .first()
        )
        if not has_session:
            break
        streak += 1
        cursor -= timedelta(days=1)

    return streak


def _avg_quiz_score(
    db: Session,
    user_id: UUID,
    since: datetime,
    until: Optional[datetime] = None,
) -> Optional[float]:
    until = until or datetime.now(timezone.utc)
    result = (
        db.query(func.avg(Quiz.score))
        .filter(
            Quiz.user_id == user_id,
            Quiz.status == QuizStatus.completed,
            Quiz.completed_at >= since,
            Quiz.completed_at < until,
            Quiz.score.isnot(None),
        )
        .scalar()
    )
    return round(float(result), 1) if result is not None else None


# ---------------------------------------------------------------------------
# Ponto de entrada público
# ---------------------------------------------------------------------------

def get_realtime_dashboard(db: Session, user_id: UUID) -> dict:
    """Retorna métricas agregadas para o dashboard em tempo real.

    Retorna:
        {
            "minutes_today": int,
            "minutes_week": int,
            "sessions_today": int,
            "sessions_week": int,
            "current_streak": int,
            "avg_quiz_score_week": float | None,
        }
    """
    today = _today_utc()
    start_today = _start_of_day(today)
    start_week = _start_of_day(today - timedelta(days=6))  # 7 dias incluindo hoje

    return {
        "minutes_today": _minutes_studied(db, user_id, since=start_today),
        "minutes_week": _minutes_studied(db, user_id, since=start_week),
        "sessions_today": _sessions_count(db, user_id, since=start_today),
        "sessions_week": _sessions_count(db, user_id, since=start_week),
        "current_streak": _current_streak(db, user_id),
        "avg_quiz_score_week": _avg_quiz_score(db, user_id, since=start_week),
    }
