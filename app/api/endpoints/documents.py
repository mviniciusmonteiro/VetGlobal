import asyncio
import time
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services import document_service
from app.services.document_service import (
    EmptyFileError,
    FileSizeExceededError,
    PetNotFoundError,
    UnsupportedFileExtensionError,
)

router = APIRouter(tags=["Documents"])


@router.post(
    "/pets/{pet_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload de documento clínico para um Pet",
    description=(
        "Recebe um arquivo clínico (.txt ou .pdf) de até 10 MB, persiste os dados binários "
        "diretamente no PostgreSQL de forma stateless e atômica, enfileira um Job assíncrono "
        "e retorna HTTP 202 Accepted com os identificadores para rastreamento."
    ),
)
async def upload_pet_document(
    pet_id: int,
    file: UploadFile = File(..., description="Arquivo clínico nos formatos .txt ou .pdf (máx. 10 MB)"),
    db: Session = Depends(get_db),
) -> DocumentUploadResponse:
    """Endpoint para upload de documento associado a um pet."""
    try:
        doc, job = await document_service.upload_document_for_pet(
            db=db,
            pet_id=pet_id,
            file=file,
        )
    except PetNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except UnsupportedFileExtensionError as e:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(e),
        )
    except FileSizeExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=str(e),
        )
    except EmptyFileError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(e),
        )

    return DocumentUploadResponse(
        document_id=doc.id,
        job_id=job.id,
        status=job.status,
    )


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Consultar estado atual e resultado do documento",
    description=(
        "Retorna os metadados do documento clínico, seu status atual (PENDING, READY, FAILED), "
        "o resumo consolidado gerado pelo worker ou a mensagem de erro, além do timestamp de conclusão."
    ),
)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Endpoint para consulta de documento pelo seu ID."""
    doc = document_service.get_document_by_id(db=db, document_id=document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Documento com id {document_id} não encontrado.",
        )
    return doc


@router.get(
    "/documents/{document_id}/poll",
    response_model=Optional[DocumentResponse],
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_200_OK: {
            "model": DocumentResponse,
            "description": "Documento processado com sucesso ou falha finalizada.",
        },
        status.HTTP_204_NO_CONTENT: {
            "description": "Timeout de polling atingido sem conclusão do processamento.",
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "Documento não encontrado.",
        },
    },
    summary="Aguardar reativamente a conclusão do processamento de um documento (Long Polling)",
    description=(
        "Mantém a conexão aberta por até 25 segundos aguardando que o Job associado "
        "ao documento atinja um estado terminal (DONE ou FAILED) com id >= after_job_id. "
        "Retorna 200 OK com o documento se concluído, 204 No Content caso o timeout expire, "
        "ou 404 Not Found caso o documento não exista."
    ),
)
async def poll_document(
    document_id: int,
    after_job_id: int = Query(0, ge=0, description="Filtrar por jobs com id maior ou igual a este valor"),
    db: Session = Depends(get_db),
):
    """Endpoint para long polling de documento sem bloquear threads do servidor."""
    # 1. Validação imediata: se o documento não existir, retorna 404 sem entrar no loop de espera
    doc = await run_in_threadpool(document_service.get_document_by_id, db=db, document_id=document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Documento com id {document_id} não encontrado.",
        )

    # 2. Loop de polling não-bloqueante no Event Loop
    deadline = time.monotonic() + settings.POLL_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        completed_doc = await run_in_threadpool(
            document_service.check_document_completion,
            db=db,
            document_id=document_id,
            after_job_id=after_job_id,
        )
        if completed_doc:
            return completed_doc

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break

        sleep_duration = min(settings.POLL_INTERVAL_SECONDS, remaining)
        await asyncio.sleep(sleep_duration)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


