import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse
import pytest
from dotenv import load_dotenv

# 1. Carregar variáveis do .env base (onde residem as credenciais locais do desenvolvedor)
base_env_file = Path(__file__).resolve().parent.parent / ".env"
if base_env_file.exists():
    load_dotenv(base_env_file)

# 2. Carregar variáveis de teste do .env.test se existir
test_env_file = Path(__file__).resolve().parent.parent / ".env.test"
if test_env_file.exists():
    load_dotenv(test_env_file)

# 3. Derivar automaticamente a URL do banco de testes:
# Substitui o nome do banco para 'vetglobal_test' mantendo as credenciais locais seguras em memória
current_db_url = os.environ.get("DATABASE_URL", "")
if current_db_url and not current_db_url.endswith("/vetglobal_test"):
    parsed = urlparse(current_db_url)
    os.environ["DATABASE_URL"] = urlunparse(parsed._replace(path="/vetglobal_test"))

# Garantir timeouts de polling rápidos para a suíte de testes
os.environ["POLL_TIMEOUT_SECONDS"] = "2"
os.environ["POLL_INTERVAL_SECONDS"] = "0.1"
os.environ["UPLOAD_DIR"] = "uploads_test"

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.pet import Pet
import app.models  # noqa: F401 - assegura registro dos modelos no Base.metadata


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Garante que todas as tabelas estejam criadas no banco de testes antes da execução da suíte."""
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db_session():
    """Fornece uma sessão de banco de dados isolada para testes diretos de modelos e queries."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def pet_tracker():
    """
    Fixture compartilhada para rastrear e limpar pets criados durante os testes.
    Executa deleção em cascata (Pet -> Document -> Job) no teardown para garantir
    isolamento total e ausência de efeitos colaterais entre testes.
    """
    pet_ids = []

    def _track(pet_id: int):
        pet_ids.append(pet_id)

    yield _track

    # Limpeza no banco de dados após a conclusão do teste
    db = SessionLocal()
    try:
        for pet_id in pet_ids:
            pet = db.get(Pet, pet_id)
            if pet:
                db.delete(pet)
        db.commit()
    finally:
        db.close()


@pytest.fixture
def tracker(pet_tracker):
    """Alias para pet_tracker para compatibilidade com a suite de pets."""
    return pet_tracker

