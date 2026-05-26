from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/openapi.json",
)

# Configuração de CORS para permitir requisições do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, adicionar apenas a origem real do front (ex: http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Bem-vindo à API do Tempus!"}

from app.routers import auth, chat, dashboard, notebook, quizzes, subjects, sessions, study_plans

# Registrar roteadores
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(subjects.router, prefix="/api/subjects", tags=["Subjects"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["Quizzes"])
app.include_router(notebook.router, prefix="/api/notebooks", tags=["Notebooks"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(study_plans.router, prefix="/api/study-plans", tags=["Study Plans"])