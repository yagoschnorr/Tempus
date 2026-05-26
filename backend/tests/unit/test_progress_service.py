"""Testes unitários do progress_service — direto contra a sessão (sem TestClient).

Cobre:
* `minutes_today` / `minutes_week` — soma de `actual_duration_seconds` de sessões
  completadas nos intervalos corretos.
* `sessions_today` / `sessions_week` — contagem de sessões completadas.
* `current_streak` — dias consecutivos com ao menos 1 sessão completada.
* `avg_quiz_score_week` — média de scores de quizzes completados na semana.
* Isolamento: sessões de outros usuários não vazam.
* Status: apenas `completed` entra nas métricas.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.models.quiz import Quiz, QuizSourceType, QuizStatus
from app.models.session import SessionStatus, StudySession
from app.models.user import User
from app.services.progress_service import get_realtime_dashboard


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _add_session(
    db,
    user: User,
    *,
    actual_seconds: int = 3600,
    status: SessionStatus = SessionStatus.completed,
    ended_at: datetime | None = None,
) -> StudySession:
    ended = ended_at or _utcnow()
    session = StudySession(
        user_id=user.id,
        planned_duration_seconds=actual_seconds,
        actual_duration_seconds=actual_seconds,
        status=status,
        started_at=ended - timedelta(seconds=actual_seconds),
        ended_at=ended,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _add_quiz(
    db,
    user: User,
    *,
    score: int = 80,
    status: QuizStatus = QuizStatus.completed,
    completed_at: datetime | None = None,
) -> Quiz:
    quiz = Quiz(
        user_id=user.id,
        title="Quiz teste",
        source_type=QuizSourceType.general_topic,
        topic_description="tema",
        total_questions=5,
        score=score if status == QuizStatus.completed else None,
        status=status,
        completed_at=completed_at or (_utcnow() if status == QuizStatus.completed else None),
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


# ---------------------------------------------------------------------------
# Baseline — usuário sem dados
# ---------------------------------------------------------------------------

def test_all_metrics_are_zero_for_new_user(db, test_user):
    result = get_realtime_dashboard(db, test_user.id)

    assert result["minutes_today"] == 0
    assert result["minutes_week"] == 0
    assert result["sessions_today"] == 0
    assert result["sessions_week"] == 0
    assert result["current_streak"] == 0
    assert result["avg_quiz_score_week"] is None


# ---------------------------------------------------------------------------
# minutes_today / sessions_today
# ---------------------------------------------------------------------------

def test_minutes_today_sums_completed_sessions_ended_today(db, test_user):
    _add_session(db, test_user, actual_seconds=3600)   # 60 min
    _add_session(db, test_user, actual_seconds=1800)   # 30 min

    result = get_realtime_dashboard(db, test_user.id)
    assert result["minutes_today"] == 90


def test_sessions_today_counts_only_completed(db, test_user):
    _add_session(db, test_user, status=SessionStatus.completed)
    _add_session(db, test_user, status=SessionStatus.abandoned)
    _add_session(db, test_user, status=SessionStatus.in_progress)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["sessions_today"] == 1


def test_minutes_today_excludes_session_from_yesterday(db, test_user):
    yesterday_end = _utcnow() - timedelta(days=1)
    _add_session(db, test_user, actual_seconds=7200, ended_at=yesterday_end)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["minutes_today"] == 0
    assert result["sessions_today"] == 0


# ---------------------------------------------------------------------------
# minutes_week / sessions_week
# ---------------------------------------------------------------------------

def test_minutes_week_includes_last_7_days(db, test_user):
    # 3 dias atrás — dentro da janela
    _add_session(db, test_user, actual_seconds=3600, ended_at=_utcnow() - timedelta(days=3))
    # 6 dias atrás — dentro da janela
    _add_session(db, test_user, actual_seconds=3600, ended_at=_utcnow() - timedelta(days=6))

    result = get_realtime_dashboard(db, test_user.id)
    assert result["minutes_week"] == 120
    assert result["sessions_week"] == 2


def test_minutes_week_excludes_8_days_ago(db, test_user):
    _add_session(db, test_user, actual_seconds=3600, ended_at=_utcnow() - timedelta(days=8))

    result = get_realtime_dashboard(db, test_user.id)
    assert result["minutes_week"] == 0


def test_minutes_today_is_subset_of_minutes_week(db, test_user):
    # Sessão hoje
    _add_session(db, test_user, actual_seconds=1800)
    # Sessão 4 dias atrás
    _add_session(db, test_user, actual_seconds=3600, ended_at=_utcnow() - timedelta(days=4))

    result = get_realtime_dashboard(db, test_user.id)
    assert result["minutes_today"] == 30
    assert result["minutes_week"] == 90
    assert result["minutes_today"] <= result["minutes_week"]


# ---------------------------------------------------------------------------
# Isolamento entre usuários
# ---------------------------------------------------------------------------

def test_metrics_do_not_leak_between_users(db, test_user):
    other = User(name="Outro", email=f"outro-{uuid4().hex[:6]}@tempus.dev", password_hash="x")
    db.add(other)
    db.commit()
    db.refresh(other)

    # Sessão do outro usuário — não deve aparecer para test_user
    _add_session(db, other, actual_seconds=7200)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["minutes_today"] == 0
    assert result["sessions_today"] == 0


# ---------------------------------------------------------------------------
# current_streak
# ---------------------------------------------------------------------------

def test_streak_is_one_with_only_todays_session(db, test_user):
    _add_session(db, test_user)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["current_streak"] == 1


def test_streak_counts_consecutive_days(db, test_user):
    for days_ago in range(4):  # hoje, ontem, anteontem, 3 dias atrás
        _add_session(db, test_user, ended_at=_utcnow() - timedelta(days=days_ago))

    result = get_realtime_dashboard(db, test_user.id)
    assert result["current_streak"] == 4


def test_streak_breaks_on_gap(db, test_user):
    # Hoje e ontem: streak 2
    # Mas 3 dias atrás sem sessão → quebra; 4 dias atrás não importa
    _add_session(db, test_user, ended_at=_utcnow())
    _add_session(db, test_user, ended_at=_utcnow() - timedelta(days=1))
    # gap no dia 2
    _add_session(db, test_user, ended_at=_utcnow() - timedelta(days=3))

    result = get_realtime_dashboard(db, test_user.id)
    assert result["current_streak"] == 2


def test_streak_is_zero_with_no_session_today(db, test_user):
    # Sessão ontem — streak quebra porque hoje não tem
    _add_session(db, test_user, ended_at=_utcnow() - timedelta(days=1))

    result = get_realtime_dashboard(db, test_user.id)
    assert result["current_streak"] == 0


def test_streak_ignores_non_completed_sessions(db, test_user):
    _add_session(db, test_user, status=SessionStatus.abandoned)
    _add_session(db, test_user, status=SessionStatus.in_progress)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["current_streak"] == 0


# ---------------------------------------------------------------------------
# avg_quiz_score_week
# ---------------------------------------------------------------------------

def test_avg_quiz_score_week_returns_none_when_no_quizzes(db, test_user):
    result = get_realtime_dashboard(db, test_user.id)
    assert result["avg_quiz_score_week"] is None


def test_avg_quiz_score_week_averages_completed_quizzes(db, test_user):
    _add_quiz(db, test_user, score=80)
    _add_quiz(db, test_user, score=60)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["avg_quiz_score_week"] == pytest.approx(70.0)


def test_avg_quiz_score_week_excludes_non_completed(db, test_user):
    _add_quiz(db, test_user, score=100)
    _add_quiz(db, test_user, status=QuizStatus.in_progress)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["avg_quiz_score_week"] == pytest.approx(100.0)


def test_avg_quiz_score_week_excludes_quizzes_older_than_7_days(db, test_user):
    _add_quiz(db, test_user, score=100, completed_at=_utcnow() - timedelta(days=8))

    result = get_realtime_dashboard(db, test_user.id)
    assert result["avg_quiz_score_week"] is None


def test_avg_quiz_score_week_does_not_leak_other_users(db, test_user):
    other = User(name="Outro2", email=f"outro2-{uuid4().hex[:6]}@tempus.dev", password_hash="x")
    db.add(other)
    db.commit()
    db.refresh(other)

    _add_quiz(db, other, score=100)

    result = get_realtime_dashboard(db, test_user.id)
    assert result["avg_quiz_score_week"] is None