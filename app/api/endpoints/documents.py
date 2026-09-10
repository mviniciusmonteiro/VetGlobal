from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.document import DocumentUploadResponse
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
