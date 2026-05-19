from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

# Engine para o PostgreSQL (psycopg2 ou asyncpg, aqui usaremos o padrão síncrono inicial ou o de preferência)
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Classe base para os modelos do SQLAlchemy
Base = declarative_base()

# Dependência do FastAPI para injetar a sessão do banco
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
