def test_generate_study_plan(client, auth_headers):
    # Precisamos criar um Subject primeiro para relacionar com o Study Plan
    # Usaremos um payload simples para simular a criação via api primeiro
    subject_resp = client.post(
        "/api/subjects", 
        json={"name": "Matematica Discreta", "weekly_goal_minutes": 100}, 
        headers=auth_headers
    )
    assert subject_resp.status_code == 201
    subject_id = subject_resp.json()["id"]

    # Criação do Study Plan
    payload = {
        "title": "Primeiro Semestre",
        "exam_date": "2026-06-30",
        "daily_hours_available": 4.5,
        "subjects": [
            {
                "subject_id": subject_id,
                "priority": "high"
            }
        ]
    }
    
    response = client.post("/api/study-plans/generate", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    
    assert data["title"] == "Primeiro Semestre"
    assert data["daily_hours_available"] == 4.5
    assert data["status"] == "active"
    assert "plan_content" in data
    assert "Matéria ID" in data["plan_content"]
    assert "Alta **(Prioridade Máxima)**" in data["plan_content"]
    assert len(data["subjects"]) == 1
    assert data["subjects"][0]["subject_id"] == subject_id


def test_get_study_plans(client, auth_headers):
    # Geramos um para testar listagem
    subject_resp = client.post(
        "/api/subjects", 
        json={"name": "Logica", "weekly_goal_minutes": 100}, 
        headers=auth_headers
    )
    subject_id = subject_resp.json()["id"]

    client.post(
        "/api/study-plans/generate", 
        json={
            "title": "Plano Mock", 
            "daily_hours_available": 2.0, 
            "subjects": [{"subject_id": subject_id, "priority": "low"}]
        }, 
        headers=auth_headers
    )
    
    response = client.get("/api/study-plans", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    
    # Testa listando plano pelo ID especifico
    plan_id = data[0]["id"]
    response_single = client.get(f"/api/study-plans/{plan_id}", headers=auth_headers)
    assert response_single.status_code == 200
    assert response_single.json()["id"] == plan_id


def test_update_study_plan_status(client, auth_headers):
    subject_resp = client.post(
        "/api/subjects", 
        json={"name": "Fisica 1", "weekly_goal_minutes": 100}, 
        headers=auth_headers
    )
    subject_id = subject_resp.json()["id"]

    create_resp = client.post(
        "/api/study-plans/generate", 
        json={
            "title": "Plano Mock Para Atualizar", 
            "daily_hours_available": 2.0, 
            "subjects": [{"subject_id": subject_id, "priority": "low"}]
        }, 
        headers=auth_headers
    )
    
    plan_id = create_resp.json()["id"]
    
    response = client.patch(
        f"/api/study-plans/{plan_id}", 
        json={"status": "completed"}, 
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
