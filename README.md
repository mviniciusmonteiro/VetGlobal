# 🐾 VetGlobal — Backend API

API assíncrona para gerenciamento de pets e processamento de documentos clínicos veterinários.

O sistema recebe cadastros e arquivos de prontuários clínicos, cria tarefas de processamento em segundo plano e disponibiliza endpoints para acompanhamento assíncrono de status e sumarização.

---

## 🚀 Tecnologias

* **Python 3.11+**
* **FastAPI** — Framework web moderno e de alta performance
* **Uvicorn** — Servidor ASGI
* **SQLAlchemy 2.0** — ORM relacional com tipagem estrita
* **PostgreSQL** — Banco de dados relacional
* **Pydantic v2** — Validação de contratos e dados
* **Pytest** — Testes automatizados

---

## 📌 Funcionalidades

* **Monitoramento:** Endpoint de verificação de integridade (`GET /health`).
* **Gestão de Pets:**
  * Cadastro de novos pets associados a um tutor (`POST /pets`).
  * Consulta detalhada de pet por ID (`GET /pets/{pet_id}`).
  * Listagem paginada de pets cadastrados (`GET /pets`).
* **Processamento Clínico:** Upload de documentos e acompanhamento de status de sumarização via jobs assíncronos.

---

## 🛠️ Como Executar o Projeto

### 1. Pré-requisitos
* Python 3.11+ instalado
* PostgreSQL ativo e rodando

### 2. Instalação

```bash
# Clone o repositório
git clone https://github.com/mviniciusmonteiro/VetGlobal.git
cd VetGlobal

# Crie e ative o ambiente virtual
# No Windows:
python -m venv venv
.\venv\Scripts\activate

# No Linux/Mac:
python3 -m venv venv
source venv/bin/activate

# Instale as dependências
pip install -r requirements.txt
```

### 3. Configuração do Ambiente
Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
APP_NAME=VetGlobal
ENVIRONMENT=development
DEBUG=True

DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/vetglobal

POLL_TIMEOUT_SECONDS=25
POLL_INTERVAL_SECONDS=1
UPLOAD_DIR=uploads
```

### 4. Iniciar o Servidor

```bash
uvicorn app.main:app --reload
```

Acesse no navegador:
* **API:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
* **Swagger UI (Documentação Interativa):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🧪 Testes Automatizados

Para rodar toda a suíte de testes com `pytest`:

```bash
pytest -v
```
