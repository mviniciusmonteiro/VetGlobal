from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.job import Job
from app.models.document import Document
from app.schemas.document import DocumentStatus, JobStatus


class JobServiceError(Exception):
    """Classe base para erros do serviço de jobs."""
    pass


class JobNotFoundError(JobServiceError):
    """Lançada quando o job solicitado não existe."""
    pass


class JobTerminalStateConflictError(JobServiceError):
    """Lançada quando se tenta alterar um job já finalizado em um estado terminal diferente."""
    pass


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


def complete_job(
    db: Session,
    job_id: int,
    status: str,
    summary: Optional[str] = None,
    error: Optional[str] = None,
) -> Tuple[Job, Document]:
    """
    Processa a conclusão de um Job enviado pelo worker.

    Regras de Negócio e Idempotência:
    1. Se o job não for encontrado, lança JobNotFoundError (HTTP 404).
    2. Se o job já estiver em estado terminal (DONE ou FAILED):
       - Se a requisição contiver o MESMO status terminal: operação idempotente. Retorna o job
         e o documento sem alterações adicionais (HTTP 200).
       - Se a requisição tentar mudar o status terminal (ex: DONE -> FAILED ou FAILED -> DONE):
         lança JobTerminalStateConflictError (HTTP 409 Conflict), garantindo a imutabilidade
         do resultado do processamento.
    3. Se o job estiver em andamento (ENQUEUED ou PROCESSING):
       - Transiciona o Job para o status informado (DONE ou FAILED).
       - Registra completed_at com timestamp UTC.
       - Atualiza o Document associado atomicamente:
         - DONE: Document status = READY, preenche summary, limpa error.
         - FAILED: Document status = FAILED, preenche error, limpa summary.
       - Comita a transação no PostgreSQL e atualiza as instâncias.
    """
    # Consulta com Lock Pessimista (FOR UPDATE) para serializar transições concorrentes
    stmt = select(Job).where(Job.id == job_id).with_for_update()
    job = db.scalar(stmt)
    if not job:
        raise JobNotFoundError(f"Job com id {job_id} não encontrado.")

    # Verificar regras de estado terminal e idempotência
    terminal_statuses = (JobStatus.DONE.value, JobStatus.FAILED.value)
    if job.status in terminal_statuses:
        if job.status == status:
            # Idempotente: requisição idêntica repete o sucesso sem alterar dados
            return job, job.document
        raise JobTerminalStateConflictError(
            f"Job {job_id} já finalizado com status '{job.status}' e não pode ser alterado para '{status}'."
        )

    # Atualização atômica de Job e Document
    now = datetime.now(timezone.utc)
    job.status = status
    job.completed_at = now

    doc = job.document
    if status == JobStatus.DONE.value:
        job.error = None
        doc.status = DocumentStatus.READY.value
        doc.summary = summary
        doc.error = None
    elif status == JobStatus.FAILED.value:
        job.error = error
        doc.status = DocumentStatus.FAILED.value
        doc.error = error
        doc.summary = None

    db.commit()
    db.refresh(job)
    db.refresh(doc)
    return job, doc
