import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.pet import Pet
from app.models.document import Document
from app.models.job import Job

client = TestClient(app)





def _create_pet_and_job(pet_tracker, pet_name="Rex") -> tuple[int, int, int]:
    """Helper para criar um pet e fazer upload de documento, gerando document_id e job_id."""
    resp_pet = client.post("/pets", json={"name": pet_name, "owner_name": "Dr. Silva"})
    assert resp_pet.status_code == 201
    pet_id = resp_pet.json()["id"]
    pet_tracker(pet_id)

    file_bytes = b"Exame clinico: paciente estavel sem febre."
    files = {"file": ("prontuario.txt", io.BytesIO(file_bytes), "text/plain")}
    resp_doc = client.post(f"/pets/{pet_id}/documents", files=files)
    assert resp_doc.status_code == 202
    data = resp_doc.json()
    return pet_id, data["document_id"], data["job_id"]


def test_complete_job_done_success(pet_tracker) -> None:
    """Testa a conclusão com sucesso (DONE) de um job pelo worker."""
    _, doc_id, job_id = _create_pet_and_job(pet_tracker, pet_name="Hank")

    payload = {
        "status": "DONE",
        "summary": "Patient has a history of intermittent vomiting.",
    }

    response = client.post(f"/internal/jobs/{job_id}/complete", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["job_id"] == job_id
    assert data["status"] == "DONE"
    assert data["document_id"] == doc_id
    assert data["document_status"] == "READY"
    assert data["summary"] == "Patient has a history of intermittent vomiting."
    assert data["error"] is None
    assert data["completed_at"] is not None

    # Verificar persistência no banco de dados PostgreSQL
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        assert job is not None
        assert job.status == "DONE"
        assert job.completed_at is not None
        assert job.error is None

        doc = db.get(Document, doc_id)
        assert doc is not None
        assert doc.status == "READY"
        assert doc.summary == "Patient has a history of intermittent vomiting."
        assert doc.error is None
    finally:
        db.close()


def test_complete_job_failed_success(pet_tracker) -> None:
    """Testa a conclusão com falha (FAILED) de um job pelo worker."""
    _, doc_id, job_id = _create_pet_and_job(pet_tracker, pet_name="Belinha")

    payload = {
        "status": "FAILED",
        "error": "Could not parse document: corrupt PDF structure",
    }

    response = client.post(f"/internal/jobs/{job_id}/complete", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["job_id"] == job_id
    assert data["status"] == "FAILED"
    assert data["document_id"] == doc_id
    assert data["document_status"] == "FAILED"
    assert data["error"] == "Could not parse document: corrupt PDF structure"
    assert data["summary"] is None
    assert data["completed_at"] is not None

    # Verificar persistência no banco
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        assert job is not None
        assert job.status == "FAILED"
        assert job.completed_at is not None
        assert job.error == "Could not parse document: corrupt PDF structure"

        doc = db.get(Document, doc_id)
        assert doc is not None
        assert doc.status == "FAILED"
        assert doc.error == "Could not parse document: corrupt PDF structure"
        assert doc.summary is None
    finally:
        db.close()


def test_complete_job_not_found() -> None:
    """Testa requisição para um job inexistente retornando 404 Not Found."""
    payload = {
        "status": "DONE",
        "summary": "Some summary",
    }
    response = client.post("/internal/jobs/9999999/complete", json=payload)
    assert response.status_code == 404
    assert "não encontrado" in response.json()["detail"].lower()


def test_complete_job_idempotency_done(pet_tracker) -> None:
    """Testa que chamadas duplicadas com status DONE são idempotentes (retornam 200 sem erro)."""
    _, doc_id, job_id = _create_pet_and_job(pet_tracker, pet_name="Max")

    payload = {
        "status": "DONE",
        "summary": "Initial successful summary.",
    }

    # Primeira chamada
    resp1 = client.post(f"/internal/jobs/{job_id}/complete", json=payload)
    assert resp1.status_code == 200
    first_completed_at = resp1.json()["completed_at"]

    # Segunda chamada (idempotente)
    resp2 = client.post(f"/internal/jobs/{job_id}/complete", json=payload)
    assert resp2.status_code == 200

    data2 = resp2.json()
    assert data2["job_id"] == job_id
    assert data2["status"] == "DONE"
    assert data2["document_status"] == "READY"
    assert data2["summary"] == "Initial successful summary."
    # Timestamp original mantido
    assert data2["completed_at"] == first_completed_at


def test_complete_job_idempotency_failed(pet_tracker) -> None:
    """Testa que chamadas duplicadas com status FAILED são idempotentes (retornam 200 sem erro)."""
    _, doc_id, job_id = _create_pet_and_job(pet_tracker, pet_name="Pipoca")

    payload = {
        "status": "FAILED",
        "error": "OCR engine timeout",
    }

    # Primeira chamada
    resp1 = client.post(f"/internal/jobs/{job_id}/complete", json=payload)
    assert resp1.status_code == 200

    # Segunda chamada (idempotente)
    resp2 = client.post(f"/internal/jobs/{job_id}/complete", json=payload)
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "FAILED"
    assert resp2.json()["document_status"] == "FAILED"
    assert resp2.json()["error"] == "OCR engine timeout"


def test_complete_job_conflict_done_to_failed(pet_tracker) -> None:
    """Testa que tentar alterar um job já finalizado como DONE para FAILED retorna 409 Conflict."""
    _, doc_id, job_id = _create_pet_and_job(pet_tracker, pet_name="Bob")

    # Finalizar como DONE
    resp_done = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "DONE", "summary": "Valid summary."},
    )
    assert resp_done.status_code == 200

    # Tentar sobrescrever para FAILED
    resp_conflict = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "FAILED", "error": "Attempted override to error."},
    )
    assert resp_conflict.status_code == 409
    assert "já finalizado" in resp_conflict.json()["detail"].lower()
    assert "não pode ser alterado" in resp_conflict.json()["detail"].lower()

    # Garantir que o estado no banco permaneceu DONE / READY
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        assert job.status == "DONE"
        doc = db.get(Document, doc_id)
        assert doc.status == "READY"
        assert doc.summary == "Valid summary."
        assert doc.error is None
    finally:
        db.close()


def test_complete_job_conflict_failed_to_done(pet_tracker) -> None:
    """Testa que tentar alterar um job já finalizado como FAILED para DONE retorna 409 Conflict."""
    _, doc_id, job_id = _create_pet_and_job(pet_tracker, pet_name="Luna")

    # Finalizar como FAILED
    resp_failed = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "FAILED", "error": "Original error."},
    )
    assert resp_failed.status_code == 200

    # Tentar sobrescrever para DONE
    resp_conflict = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "DONE", "summary": "Attempted override to done."},
    )
    assert resp_conflict.status_code == 409
    assert "já finalizado" in resp_conflict.json()["detail"].lower()
    assert "não pode ser alterado" in resp_conflict.json()["detail"].lower()

    # Garantir que o estado no banco permaneceu FAILED
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        assert job.status == "FAILED"
        doc = db.get(Document, doc_id)
        assert doc.status == "FAILED"
        assert doc.error == "Original error."
        assert doc.summary is None
    finally:
        db.close()


def test_complete_job_invalid_status(pet_tracker) -> None:
    """Testa que enviar status não terminal (ex: ENQUEUED, PENDING, ou aleatório) retorna 422."""
    _, _, job_id = _create_pet_and_job(pet_tracker, pet_name="Toby")

    invalid_statuses = ["ENQUEUED", "PROCESSING", "PENDING", "COMPLETED", "XYZ"]

    for inv_status in invalid_statuses:
        resp = client.post(
            f"/internal/jobs/{job_id}/complete",
            json={"status": inv_status, "summary": "test"},
        )
        assert resp.status_code == 422
