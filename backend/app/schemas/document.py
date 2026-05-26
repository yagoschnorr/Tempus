from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.models.document import DocumentStatus

class DocumentOut(BaseModel):
    id: UUID
    user_id: UUID
    subject_id: Optional[UUID]
    filename: str
    file_size_bytes: int
    mime_type: str
    total_pages: Optional[int]
    total_chunks: int
    status: DocumentStatus
    error_message: Optional[str]
    uploaded_at: datetime
    processed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
