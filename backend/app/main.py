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

from app.routers import auth, notebooks, quizzes, subjects

# Registrar roteadores
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(subjects.router, prefix="/api/subjects", tags=["Subjects"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["Quizzes"])
app.include_router(notebooks.router, prefix="/api/notebooks", tags=["Notebooks"])