import pytest
from uuid import uuid4
from fastapi.testclient import TestClient

def test_create_session(client, auth_headers):
    payload = {
        "planned_duration_seconds": 1500,
        "notes": "Focused study session"
    }

    response = client.post("/api/sessions", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["planned_duration_seconds"] == 1500
    assert data["status"] == "in_progress"
    assert data["notes"] == "Focused study session"
    assert "id" in data


def test_complete_session(client, auth_headers):
    # Criar uma sessão primeiro 
    create_resp = client.post("/api/sessions", json={"planned_duration_seconds": 1500}, headers=auth_headers)
    session_id = create_resp.json()["id"]

    # Completar a sessão
    response = client.patch(f"/api/sessions/{session_id}/complete", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["actual_duration_seconds"] == 1500 # A que implementamos por fallback


def test_pause_resume_abandon_session(client, auth_headers):
    create_resp = client.post("/api/sessions", json={"planned_duration_seconds": 1500}, headers=auth_headers)
    session_id = create_resp.json()["id"]

    # Pause
    r_pause = client.patch(f"/api/sessions/{session_id}/pause", headers=auth_headers)
    assert r_pause.json()["status"] == "paused"

    # Resume
    r_resume = client.patch(f"/api/sessions/{session_id}/resume", headers=auth_headers)
    assert r_resume.json()["status"] == "in_progress"

    # Abandon
    r_abandon = client.patch(f"/api/sessions/{session_id}/abandon", headers=auth_headers)
    assert r_abandon.json()["status"] == "abandoned"
