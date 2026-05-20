from uuid import UUID
from datetime import datetime
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

_VALID_TIMEZONES = available_timezones()


class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("nome não pode ser vazio")
        return stripped

    @field_validator("timezone")
    @classmethod
    def _timezone_known(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in _VALID_TIMEZONES:
            raise ValueError("timezone IANA desconhecido")
        return v


class UserResponse(UserBase):
    id: UUID
    timezone: str
    created_at: datetime

    # Permite mapear diretamente do objeto SQLAlchemy para o Pydantic
    model_config = ConfigDict(from_attributes=True)
