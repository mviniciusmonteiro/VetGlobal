from typing import Optional
from sqlalchemy.orm import Session
from app.models.job import Job
from app.schemas.document import JobStatus


def create_job(
    db: Session,
    document_id: int,
    status: str = JobStatus.ENQUEUED.value,
) -> Job:
    """
    Cria uma nova instância de Job para um documento.
    O caller é responsável pelo commit/rollback na transação.
    """
    job = Job(
        document_id=document_id,
        status=status,
    )
    db.add(job)
    return job


def get_job_by_id(db: Session, job_id: int) -> Optional[Job]:
    """
    Recupera um Job pelo seu ID primário.
    """
    return db.get(Job, job_id)
