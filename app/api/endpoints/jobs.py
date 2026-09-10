from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.job import JobCompleteRequest, JobCompletionResponse
from app.services import job_service
from app.services.job_service import (
    JobNotFoundError,
    JobTerminalStateConflictError,
)

router = APIRouter(tags=["Jobs"])


@router.post(
    "/internal/jobs/{job_id}/complete",
    response_model=JobCompletionResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulação de conclusão de Job pelo Worker",
    description=(
        "Endpoint interno acionado pelo worker para notificar a conclusão (DONE) ou falha (FAILED) "
        "do processamento assíncrono de um documento. Atualiza atomicamente o Job e o Document associado "
        "no PostgreSQL. Implementa idempotência (repetições retornam 200) e rejeita alterações em "
        "estados terminais conflitantes com HTTP 409 Conflict."
    ),
)
def complete_job_endpoint(
    job_id: int,
    payload: JobCompleteRequest,
    db: Session = Depends(get_db),
) -> JobCompletionResponse:
    """Endpoint para registrar a conclusão ou falha de um job de processamento."""
    try:
        job, doc = job_service.complete_job(
            db=db,
            job_id=job_id,
            status=payload.status.value,
            summary=payload.summary,
            error=payload.error,
        )
    except JobNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except JobTerminalStateConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    return JobCompletionResponse(
        job_id=job.id,
        status=job.status,
        document_id=doc.id,
        document_status=doc.status,
        summary=doc.summary,
        error=doc.error,
        completed_at=job.completed_at,
    )
