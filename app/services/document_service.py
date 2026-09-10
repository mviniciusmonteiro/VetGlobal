from pathlib import Path
from typing import Optional, List
from fastapi import UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import settings
from app.models.pet import Pet
from app.models.document import Document
from app.models.job import Job
from app.schemas.document import DocumentStatus, JobStatus


class DocumentServiceError(Exception):
    """Classe base para erros do serviço de documentos."""
    pass


class PetNotFoundError(DocumentServiceError):
    """Lançada quando o pet informado não existe."""
    pass


class UnsupportedFileExtensionError(DocumentServiceError):
    """Lançada quando a extensão do arquivo não é permitida (apenas .txt e .pdf)."""
    pass


class FileSizeExceededError(DocumentServiceError):
    """Lançada quando o tamanho do arquivo excede o limite configurado (10 MB)."""
    pass


class EmptyFileError(DocumentServiceError):
    """Lançada quando o arquivo enviado está vazio."""
    pass


def validate_file_extension(filename: Optional[str]) -> str:
    """
    Valida a extensão do arquivo contra as extensões permitidas (.txt, .pdf).
    Retorna a extensão em minúsculas se válida.
    """
    if not filename:
        raise UnsupportedFileExtensionError("Nome de arquivo não informado.")

    suffix = Path(filename).suffix.lower()
    if suffix not in settings.ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(settings.ALLOWED_EXTENSIONS))
        raise UnsupportedFileExtensionError(
            f"Formato de arquivo '{suffix}' não suportado. Extensões aceitas: {allowed}."
        )
    return suffix


async def upload_document_for_pet(
    db: Session,
    pet_id: int,
    file: UploadFile,
) -> tuple[Document, Job]:
    """
    Orquestra o upload e persistência do documento e a criação do Job assíncrono:
    1. Valida se o pet existe.
    2. Valida extensão do arquivo (.txt ou .pdf).
    3. Lê os bytes do arquivo e valida o limite máximo de tamanho (10 MB).
    4. Cria atomicamente o registro Document (status=PENDING) e Job (status=ENQUEUED).
    5. Retorna a tupla (Document, Job).
    """
    # 1. Verificar se o pet existe
    pet = db.get(Pet, pet_id)
    if not pet:
        raise PetNotFoundError(f"Pet com id {pet_id} não encontrado.")

    # 2. Validar extensão
    validate_file_extension(file.filename)

    # 3. Ler conteúdo e validar tamanho
    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise EmptyFileError("O arquivo enviado está vazio (0 bytes).")

    if file_size > settings.MAX_FILE_SIZE_BYTES:
        max_mb = settings.MAX_FILE_SIZE_MB
        raise FileSizeExceededError(
            f"Arquivo de {file_size / (1024 * 1024):.2f} MB excede o limite máximo permitido de {max_mb} MB."
        )

    # 4. Criar registros no PostgreSQL na mesma transação (ACID)
    doc = Document(
        pet_id=pet_id,
        filename=file.filename or "unnamed_document",
        file_content=content,
        file_size=file_size,
        content_type=file.content_type,
        status=DocumentStatus.PENDING.value,
    )
    db.add(doc)
    db.flush()  # Garante a geração de doc.id

    job = Job(
        document_id=doc.id,
        status=JobStatus.ENQUEUED.value,
    )
    db.add(job)

    db.commit()
    db.refresh(doc)
    db.refresh(job)

    return doc, job


def get_document_by_id(db: Session, document_id: int) -> Optional[Document]:
    """
    Recupera um Document pelo seu ID primário.
    """
    return db.get(Document, document_id)


def list_documents_by_pet(db: Session, pet_id: int) -> List[Document]:
    """
    Lista todos os documentos associados a um pet.
    """
    stmt = select(Document).where(Document.pet_id == pet_id).order_by(Document.id)
    return list(db.scalars(stmt).all())
