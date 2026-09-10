from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class JobTerminalStatus(str, Enum):
    """Status finais permitidos na conclusão do job pelo worker."""
    DONE = "DONE"
    FAILED = "FAILED"


class JobCompleteRequest(BaseModel):
    """Payload enviado pelo worker ao concluir o processamento de um job."""
    status: JobTerminalStatus = Field(
        ...,
        description="Status final do job (apenas DONE ou FAILED)",
        examples=["DONE", "FAILED"],
    )
    summary: Optional[str] = Field(
        default=None,
        description="Resumo clínico gerado pelo worker (esperado se status=DONE)",
        examples=["Patient has a history of intermittent vomiting."],
    )
    error: Optional[str] = Field(
        default=None,
        description="Mensagem descritiva de erro (esperada se status=FAILED)",
        examples=["Could not parse document"],
    )

    model_config = ConfigDict(from_attributes=True)


class JobCompletionResponse(BaseModel):
    """Resposta retornada após a conclusão do job ou confirmação de idempotência."""
    job_id: int = Field(..., description="Identificador único do Job")
    status: str = Field(..., description="Status atual do Job (DONE ou FAILED)")
    document_id: int = Field(..., description="Identificador do documento associado")
    document_status: str = Field(..., description="Status atual do documento (READY ou FAILED)")
    summary: Optional[str] = Field(default=None, description="Resumo clínico consolidado")
    error: Optional[str] = Field(default=None, description="Mensagem de erro consolidada, se houver")
    completed_at: Optional[datetime] = Field(
        default=None,
        description="Data e hora em que o processamento foi concluído",
    )

    model_config = ConfigDict(from_attributes=True)
