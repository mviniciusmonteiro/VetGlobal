import pytest
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.pet import Pet
from app.models.document import Document
from app.models.job import Job


@pytest.fixture
def db_session():
    """Provides a transactional database session for testing."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_database_connection(db_session):
    """Test that the database connection is active and can execute queries."""
    result = db_session.execute(select(1)).scalar()
    assert result == 1


def test_pet_document_job_lifecycle(db_session):
    """Test creation, relationships, updates, and cascade delete across Pet, Document, and Job."""
    # 1. Create a Pet
    pet = Pet(name="Rex Test", owner_name="Alice Owner")
    db_session.add(pet)
    db_session.commit()
    db_session.refresh(pet)

    assert pet.id is not None
    assert pet.name == "Rex Test"
    assert pet.created_at is not None

    # 2. Create a Document associated with the Pet
    doc = Document(
        pet_id=pet.id,
        filename="exame_rex.pdf",
        file_content=b"%PDF-1.4 test binary content",
        file_size=28,
        content_type="application/pdf",
        status="PENDING",
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    assert doc.id is not None
    assert doc.pet_id == pet.id
    assert doc.status == "PENDING"
    assert doc.file_size == 28
    assert doc.file_content == b"%PDF-1.4 test binary content"
    assert doc.created_at is not None

    # 3. Create a Job associated with the Document
    job = Job(
        document_id=doc.id,
        status="ENQUEUED",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    assert job.id is not None
    assert job.document_id == doc.id
    assert job.status == "ENQUEUED"

    # 4. Verify relationships
    # Pet -> Document -> Job
    db_session.refresh(pet)
    assert len(pet.documents) == 1
    assert pet.documents[0].id == doc.id
    assert len(pet.documents[0].jobs) == 1
    assert pet.documents[0].jobs[0].id == job.id

    # Job -> Document -> Pet
    assert job.document.id == doc.id
    assert job.document.pet.id == pet.id

    # 5. Verify update
    job.status = "DONE"
    doc.status = "DONE"
    doc.summary = "Exame clínico normal sem alterações patológicas."
    db_session.commit()

    updated_doc = db_session.get(Document, doc.id)
    assert updated_doc.status == "DONE"
    assert "normal" in updated_doc.summary

    # 6. Verify Cascade Delete (deleting pet removes document and job)
    pet_id = pet.id
    doc_id = doc.id
    job_id = job.id

    db_session.delete(pet)
    db_session.commit()

    assert db_session.get(Pet, pet_id) is None
    assert db_session.get(Document, doc_id) is None
    assert db_session.get(Job, job_id) is None
