import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    email = Column(String(160), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    timezone = Column(String(64), nullable=False, default="America/Belem")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
