from datetime import datetime
from enum import Enum
from typing import Optional
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
    """Schema de resposta retornado ao realizar upload de documento (HTTP 202 ou 200 idempotente)."""
    document_id: int = Field(..., description="ID do documento criado ou existente")
    job_id: int = Field(..., description="ID do job de processamento enfileirado ou existente")
    status: str = Field(
        default=JobStatus.ENQUEUED.value,
        description="Status do processamento (ENQUEUED, PROCESSING, DONE)",
        examples=["ENQUEUED"],
    )
    is_duplicate: bool = Field(
        default=False,
        description="Indica se a requisição foi atendida de forma idempotente por deduplicação de conteúdo",
    )

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    """Schema de resposta para consulta do estado atual e metadados de um Documento."""
    id: int = Field(..., description="Identificador único do documento")
    pet_id: int = Field(..., description="Identificador do pet associado ao documento")
    filename: str = Field(..., description="Nome original do arquivo enviado")
    file_size: int = Field(..., description="Tamanho do arquivo em bytes")
    status: str = Field(..., description="Status atual do documento (PENDING, READY, FAILED)")
    summary: Optional[str] = Field(default=None, description="Resumo clínico consolidado pelo worker")
    error: Optional[str] = Field(default=None, description="Mensagem de erro caso o processamento tenha falhado")
    created_at: Optional[datetime] = Field(default=None, description="Data e hora de envio do documento")
    completed_at: Optional[datetime] = Field(
        default=None,
        description="Data e hora de conclusão do processamento (métrica de observabilidade)",
    )
    duration_ms: Optional[int] = Field(
        default=None,
        description="Duração total do processamento do job em milissegundos (observabilidade)",
    )

    model_config = ConfigDict(from_attributes=True)


