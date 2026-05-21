"""Schemas Pydantic do módulo de Notebooks e Notes.

Camadas:
* **Input**: o que chega do frontend (NotebookCreate, NotebookUpdate,
  NoteCreate, NoteUpdate).
* **Output**: o que volta para o frontend (NotebookOut, NoteOut).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Notebooks — Input
# =============================================================================
class NotebookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    color: str = Field(default="#0F6E56", pattern=r"^#[0-9A-Fa-f]{6}$")


class NotebookUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


# =============================================================================
# Notebooks — Output
# =============================================================================
class NotebookOut(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    color: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Notes — Input
# =============================================================================
class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="")


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = None


# =============================================================================
# Notes — Output
# =============================================================================
class NoteOut(BaseModel):
    id: UUID
    notebook_id: UUID
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Summary (IA) — Output  [UC: POST /notes/{id}/summary]
# =============================================================================
class NoteSummaryOut(BaseModel):
    summary: str