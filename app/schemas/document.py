from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class DocumentStatus(str, Enum):
    """Estados possíveis para um Documento."""
    PENDING = "PENDING"
    READY = "READY"
    FAILED = "FAILED"


class JobStatus(str, Enum):
    """Estados possíveis para um Job de processamento."""
    ENQUEUED = "ENQUEUED"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


class DocumentUploadResponse(BaseModel):
    """Schema de resposta retornado ao realizar upload de documento (HTTP 202)."""
    document_id: int = Field(..., description="ID do documento criado")
    job_id: int = Field(..., description="ID do job de processamento enfileirado")
    status: str = Field(
        default=JobStatus.ENQUEUED.value,
        description="Status inicial do processamento (ENQUEUED)",
        examples=["ENQUEUED"],
    )

    model_config = ConfigDict(from_attributes=True)
