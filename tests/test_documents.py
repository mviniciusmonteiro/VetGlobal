import asyncio
import io
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.pet import Pet
from app.models.document import Document
from app.models.job import Job

client = TestClient(app)





def _create_test_pet(pet_tracker, name="Bidu", owner="Mauricio") -> int:
    """Helper para criar um pet de teste via API."""
    response = client.post("/pets", json={"name": name, "owner_name": owner})
    assert response.status_code == 201
    pet_id = response.json()["id"]
    pet_tracker(pet_id)
    return pet_id


def test_upload_txt_document_success(pet_tracker) -> None:
    """Testa upload com sucesso de arquivo .txt, verificando HTTP 202 e persistência BYTEA."""
    pet_id = _create_test_pet(pet_tracker, name="Hank", owner="John Bergeson")
    file_content = b"Patient has a history of intermittent vomiting and lethargy."

    files = {
        "file": ("prontuario_hank.txt", io.BytesIO(file_content), "text/plain")
    }

    response = client.post(f"/pets/{pet_id}/documents", files=files)
    assert response.status_code == 202

    data = response.json()
    assert "document_id" in data
    assert "job_id" in data
    assert data["status"] == "ENQUEUED"

    doc_id = data["document_id"]
    job_id = data["job_id"]

    # Verificar integridade e persistência direta no PostgreSQL
    db = SessionLocal()
    try:
        db_doc = db.get(Document, doc_id)
        assert db_doc is not None
        assert db_doc.pet_id == pet_id
        assert db_doc.filename == "prontuario_hank.txt"
        assert db_doc.file_content == file_content
        assert db_doc.file_size == len(file_content)
        assert db_doc.status == "PENDING"
        assert db_doc.created_at is not None

        db_job = db.get(Job, job_id)
        assert db_job is not None
        assert db_job.document_id == doc_id
        assert db_job.status == "ENQUEUED"
        assert db_job.created_at is not None
    finally:
        db.close()


def test_upload_pdf_document_success(pet_tracker) -> None:
    """Testa upload com sucesso de arquivo .pdf."""
    pet_id = _create_test_pet(pet_tracker, name="Thor", owner="Carla")
    pdf_content = b"%PDF-1.4 simulated pdf binary content with lab results"

    files = {
        "file": ("hemograma_thor.pdf", io.BytesIO(pdf_content), "application/pdf")
    }

    response = client.post(f"/pets/{pet_id}/documents", files=files)
    assert response.status_code == 202

    data = response.json()
    assert data["status"] == "ENQUEUED"
    assert data["document_id"] > 0
    assert data["job_id"] > 0

    # Verificar no banco
    db = SessionLocal()
    try:
        db_doc = db.get(Document, data["document_id"])
        assert db_doc is not None
        assert db_doc.filename == "hemograma_thor.pdf"
        assert db_doc.file_content == pdf_content
        assert db_doc.file_size == len(pdf_content)
        assert db_doc.status == "PENDING"
    finally:
        db.close()


def test_upload_unsupported_extensions(pet_tracker) -> None:
    """Testa rejeição de arquivos com extensões não suportadas com HTTP 415."""
    pet_id = _create_test_pet(pet_tracker)

    invalid_files = [
        ("foto.png", b"\x89PNG\r\n\x1a\n", "image/png"),
        ("dados.csv", b"col1,col2\nval1,val2", "text/csv"),
        ("laudo.docx", b"PK\x03\x04 fake docx", "application/vnd.openxmlformats-officedocument"),
        ("virus.exe", b"MZ fake exe", "application/octet-stream"),
    ]

    for filename, content, mime in invalid_files:
        files = {"file": (filename, io.BytesIO(content), mime)}
        response = client.post(f"/pets/{pet_id}/documents", files=files)
        assert response.status_code == 415
        assert "não suportado" in response.json()["detail"].lower()


def test_upload_pet_not_found() -> None:
    """Testa upload de documento para pet inexistente retornando 404 Not Found."""
    files = {
        "file": ("exame.txt", io.BytesIO(b"conteudo teste"), "text/plain")
    }
    response = client.post("/pets/999999/documents", files=files)
    assert response.status_code == 404
    assert "não encontrado" in response.json()["detail"].lower()


def test_upload_file_too_large(pet_tracker) -> None:
    """Testa rejeição de arquivo com tamanho superior a 10 MB com HTTP 413."""
    pet_id = _create_test_pet(pet_tracker)

    # 10 MB + 1 byte
    oversized_content = b"x" * (10 * 1024 * 1024 + 1)
    files = {
        "file": ("gigante.txt", io.BytesIO(oversized_content), "text/plain")
    }

    response = client.post(f"/pets/{pet_id}/documents", files=files)
    assert response.status_code == 413
    assert "excede o limite" in response.json()["detail"].lower()


def test_upload_empty_file(pet_tracker) -> None:
    """Testa envio de arquivo vazio (0 bytes) retornando 422."""
    pet_id = _create_test_pet(pet_tracker)

    files = {
        "file": ("vazio.txt", io.BytesIO(b""), "text/plain")
    }

    response = client.post(f"/pets/{pet_id}/documents", files=files)
    assert response.status_code == 422
    assert "vazio" in response.json()["detail"].lower()


def test_upload_multiple_documents_same_pet(pet_tracker) -> None:
    """Testa que múltiplos uploads para o mesmo pet são permitidos e geram registros independentes."""
    pet_id = _create_test_pet(pet_tracker, name="Mel", owner="Beatriz")

    file1 = {"file": ("consulta_1.txt", io.BytesIO(b"Primeira consulta de rotina."), "text/plain")}
    file2 = {"file": ("consulta_2.txt", io.BytesIO(b"Retorno com melhora clinica."), "text/plain")}

    resp1 = client.post(f"/pets/{pet_id}/documents", files=file1)
    resp2 = client.post(f"/pets/{pet_id}/documents", files=file2)

    assert resp1.status_code == 202
    assert resp2.status_code == 202

    data1 = resp1.json()
    data2 = resp2.json()

    # Devem ter IDs diferentes
    assert data1["document_id"] != data2["document_id"]
    assert data1["job_id"] != data2["job_id"]

    # Ambos pertencem ao mesmo pet no banco
    db = SessionLocal()
    try:
        doc1 = db.get(Document, data1["document_id"])
        doc2 = db.get(Document, data2["document_id"])
        assert doc1.pet_id == pet_id
        assert doc2.pet_id == pet_id
        assert doc1.filename == "consulta_1.txt"
        assert doc2.filename == "consulta_2.txt"
    finally:
        db.close()


def test_get_document_pending(pet_tracker) -> None:
    """Testa consulta de documento recém-enviado com status PENDING."""
    pet_id = _create_test_pet(pet_tracker, name="Pipoca", owner="Lucas")
    file_bytes = b"Relato clinico em observacao."
    files = {"file": ("prontuario_pendente.txt", io.BytesIO(file_bytes), "text/plain")}

    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]

    response = client.get(f"/documents/{doc_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == doc_id
    assert data["pet_id"] == pet_id
    assert data["filename"] == "prontuario_pendente.txt"
    assert data["file_size"] == len(file_bytes)
    assert data["status"] == "PENDING"
    assert data["summary"] is None
    assert data["error"] is None
    assert data["created_at"] is not None
    assert data["completed_at"] is None
    assert data["duration_ms"] is None


def test_get_document_ready(pet_tracker) -> None:
    """Testa consulta de documento concluído com sucesso com status READY e resumo clínico."""
    pet_id = _create_test_pet(pet_tracker, name="Bob", owner="Mariana")
    file_bytes = b"Exame laboratoriais de rotina."
    files = {"file": ("exame_bob.txt", io.BytesIO(file_bytes), "text/plain")}

    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]
    job_id = upload_resp.json()["job_id"]

    # Simular conclusão pelo worker
    summary_text = "Patient has a history of intermittent vomiting."
    complete_resp = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "DONE", "summary": summary_text},
    )
    assert complete_resp.status_code == 200

    # Consultar documento
    response = client.get(f"/documents/{doc_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == doc_id
    assert data["pet_id"] == pet_id
    assert data["filename"] == "exame_bob.txt"
    assert data["status"] == "READY"
    assert data["summary"] == summary_text
    assert data["error"] is None
    assert data["created_at"] is not None
    assert data["completed_at"] is not None
    assert data["duration_ms"] is not None
    assert data["duration_ms"] >= 0


def test_get_document_failed(pet_tracker) -> None:
    """Testa consulta de documento cujo processamento falhou com status FAILED e erro descritivo."""
    pet_id = _create_test_pet(pet_tracker, name="Snoopy", owner="Charlie")
    file_bytes = b"Arquivo corrompido ou ilegivel."
    files = {"file": ("corrompido.pdf", io.BytesIO(file_bytes), "application/pdf")}

    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]
    job_id = upload_resp.json()["job_id"]

    # Simular falha pelo worker
    error_msg = "Could not parse document"
    complete_resp = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "FAILED", "error": error_msg},
    )
    assert complete_resp.status_code == 200

    # Consultar documento
    response = client.get(f"/documents/{doc_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == doc_id
    assert data["pet_id"] == pet_id
    assert data["status"] == "FAILED"
    assert data["summary"] is None
    assert data["error"] == error_msg
    assert data["completed_at"] is not None
    assert data["duration_ms"] is not None
    assert data["duration_ms"] >= 0



def test_get_document_not_found() -> None:
    """Testa consulta de documento inexistente retornando 404 Not Found."""
    response = client.get("/documents/999999")
    assert response.status_code == 404
    assert "não encontrado" in response.json()["detail"].lower()


# ==============================================================================
# Testes da Fase 8: Long Polling e Concorrência (GET /documents/{id}/poll)
# ==============================================================================

def test_poll_immediate_when_already_done(pet_tracker) -> None:
    """Testa que o poll retorna 200 OK imediatamente quando o job já estiver finalizado (DONE)."""
    pet_id = _create_test_pet(pet_tracker, name="Max", owner="Ana")
    files = {"file": ("prontuario_max.txt", io.BytesIO(b"Historico estavel."), "text/plain")}
    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]
    job_id = upload_resp.json()["job_id"]

    # Concluir o job previamente
    complete_resp = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "DONE", "summary": "Paciente saudável."},
    )
    assert complete_resp.status_code == 200

    # Chamar poll
    poll_resp = client.get(f"/documents/{doc_id}/poll?after_job_id={job_id}")
    assert poll_resp.status_code == 200
    data = poll_resp.json()
    assert data["id"] == doc_id
    assert data["status"] == "READY"
    assert data["summary"] == "Paciente saudável."
    assert data["completed_at"] is not None
    assert data["duration_ms"] is not None


@pytest.mark.asyncio
async def test_poll_concurrent_completion_done(pet_tracker) -> None:
    """Testa que o poll aguarda reativamente e retorna 200 OK assim que o worker conclui o job com DONE."""
    pet_id = _create_test_pet(pet_tracker, name="Luna", owner="Felipe")
    files = {"file": ("exame_luna.txt", io.BytesIO(b"Hemograma em processamento."), "text/plain")}
    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]
    job_id = upload_resp.json()["job_id"]

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        async def do_poll():
            return await async_client.get(f"/documents/{doc_id}/poll?after_job_id={job_id}")

        async def do_complete():
            await asyncio.sleep(0.2)
            return await async_client.post(
                f"/internal/jobs/{job_id}/complete",
                json={"status": "DONE", "summary": "Hemograma sem alteracoes."},
            )

        poll_res, complete_res = await asyncio.gather(do_poll(), do_complete())

    assert complete_res.status_code == 200
    assert poll_res.status_code == 200
    data = poll_res.json()
    assert data["id"] == doc_id
    assert data["status"] == "READY"
    assert data["summary"] == "Hemograma sem alteracoes."
    assert data["completed_at"] is not None
    assert data["duration_ms"] is not None


@pytest.mark.asyncio
async def test_poll_concurrent_completion_failed(pet_tracker) -> None:
    """Testa que o poll é desbloqueado e retorna 200 OK com erro quando o job falha (FAILED)."""
    pet_id = _create_test_pet(pet_tracker, name="Toby", owner="Camila")
    files = {"file": ("falha_toby.pdf", io.BytesIO(b"Dados ilegiveis."), "application/pdf")}
    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]
    job_id = upload_resp.json()["job_id"]

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        async def do_poll():
            return await async_client.get(f"/documents/{doc_id}/poll?after_job_id={job_id}")

        async def do_complete():
            await asyncio.sleep(0.2)
            return await async_client.post(
                f"/internal/jobs/{job_id}/complete",
                json={"status": "FAILED", "error": "Could not parse document structure."},
            )

        poll_res, complete_res = await asyncio.gather(do_poll(), do_complete())

    assert complete_res.status_code == 200
    assert poll_res.status_code == 200
    data = poll_res.json()
    assert data["id"] == doc_id
    assert data["status"] == "FAILED"
    assert data["error"] == "Could not parse document structure."
    assert data["summary"] is None
    assert data["completed_at"] is not None


def test_poll_timeout_returns_204(pet_tracker, monkeypatch) -> None:
    """Testa que o poll retorna 204 No Content quando o timeout expira sem conclusão do job."""
    monkeypatch.setattr(settings, "POLL_TIMEOUT_SECONDS", 0.5)
    monkeypatch.setattr(settings, "POLL_INTERVAL_SECONDS", 0.1)

    pet_id = _create_test_pet(pet_tracker, name="Fred", owner="Paula")
    files = {"file": ("pendente_fred.txt", io.BytesIO(b"Aguardando worker lento."), "text/plain")}
    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]
    job_id = upload_resp.json()["job_id"]

    poll_resp = client.get(f"/documents/{doc_id}/poll?after_job_id={job_id}")
    assert poll_resp.status_code == 204
    assert poll_resp.content == b""


def test_poll_respects_after_job_id_condition(pet_tracker, monkeypatch) -> None:
    """Testa que o poll respeita estritamente a condição job.id >= after_job_id."""
    monkeypatch.setattr(settings, "POLL_TIMEOUT_SECONDS", 0.4)
    monkeypatch.setattr(settings, "POLL_INTERVAL_SECONDS", 0.1)

    pet_id = _create_test_pet(pet_tracker, name="Simba", owner="Renata")
    files = {"file": ("laudo_simba.txt", io.BytesIO(b"Resultado ultrassom."), "text/plain")}
    upload_resp = client.post(f"/pets/{pet_id}/documents", files=files)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]
    job_id = upload_resp.json()["job_id"]

    # Concluir job
    complete_resp = client.post(
        f"/internal/jobs/{job_id}/complete",
        json={"status": "DONE", "summary": "Ultrassom normal."},
    )
    assert complete_resp.status_code == 200

    # 1. Com after_job_id maior que o job_id existente -> não deve encontrar e deve dar timeout 204
    poll_future = client.get(f"/documents/{doc_id}/poll?after_job_id={job_id + 10}")
    assert poll_future.status_code == 204

    # 2. Com after_job_id == job_id -> satisfaz a condição >= e retorna 200 imediatamente
    poll_exact = client.get(f"/documents/{doc_id}/poll?after_job_id={job_id}")
    assert poll_exact.status_code == 200
    assert poll_exact.json()["status"] == "READY"

    # 3. Com after_job_id default (0) -> satisfaz a condição >= e retorna 200 imediatamente
    poll_default = client.get(f"/documents/{doc_id}/poll")
    assert poll_default.status_code == 200
    assert poll_default.json()["status"] == "READY"


def test_poll_document_not_found() -> None:
    """Testa que o poll para documento inexistente retorna 404 Not Found imediatamente."""
    response = client.get("/documents/999999/poll")
    assert response.status_code == 404
    assert "não encontrado" in response.json()["detail"].lower()


