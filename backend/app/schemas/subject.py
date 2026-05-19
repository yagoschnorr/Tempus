"""Schemas Pydantic do módulo de Subjects (matérias).

Espelha as constraints do `tempus_schema-2.sql`:
* `name VARCHAR(120) NOT NULL` → `min_length=1, max_length=120`
* `color VARCHAR(7) NOT NULL` (hex) → regex `^#[0-9A-Fa-f]{6}$`
* `weekly_goal_minutes INTEGER NOT NULL CHECK (>= 0)` → `ge=0`
* UNIQUE `(user_id, name)` → validado no service (SELECT prévio → 409)

`is_active` existe no schema SQL mas não no `types.ts` do frontend — reservado
para feature de archive futura, não viaja no DTO.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

HEX_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: Optional[str] = Field(default=None, pattern=HEX_COLOR_PATTERN)
    description: Optional[str] = None
    weekly_goal_minutes: Optional[int] = Field(default=None, ge=0)


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    color: Optional[str] = Field(default=None, pattern=HEX_COLOR_PATTERN)
    description: Optional[str] = None
    weekly_goal_minutes: Optional[int] = Field(default=None, ge=0)


class SubjectOut(BaseModel):
    id: UUID
    name: str
    color: str
    description: Optional[str]
    weekly_goal_minutes: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
