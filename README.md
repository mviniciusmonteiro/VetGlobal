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

### 4. Iniciar o Servidor Localmente

```bash
uvicorn app.main:app --reload
```

---

### 🐳 Execução Rápida via Docker Compose (Recomendado)

Você pode subir toda a infraestrutura (PostgreSQL + FastAPI + Frontend React) com um único comando, sem precisar instalar dependências locais:

```bash
docker compose up --build
```

Acessos disponíveis:
* **Frontend Web (SPA):** [http://localhost:5173](http://localhost:5173)
* **API Backend:** [http://localhost:8000](http://localhost:8000)
* **Swagger UI (Docs Interativas):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🧪 Testes Automatizados

Para rodar toda a suíte de testes com `pytest`:

```bash
# Localmente:
pytest -v

# Ou isolado via container Docker:
docker compose run --rm test
```

### Estratégia de Testes

**Banco real, não SQLite.** Todos os testes rodam contra um **PostgreSQL real** (banco `vetglobal_test`), não SQLite em memória. Justificativa: SQLite não reproduz fielmente comportamentos de locks, tipos e concorrência do PostgreSQL — testar contra o mesmo banco de produção evita surpresas.

**Polling rápido nos testes.** O timeout de 25s do polling tornaria a suíte lenta. O `conftest.py` sobrescreve as variáveis para `POLL_TIMEOUT_SECONDS=2` e `POLL_INTERVAL_SECONDS=0.1`, garantindo testes rápidos sem alterar a lógica.

**Concorrência real.** Os testes de polling concorrente usam `asyncio.gather` com `httpx.AsyncClient` para disparar simultaneamente uma requisição de poll e uma chamada do worker, validando que o poll é desbloqueado corretamente quando o job completa.

**Isolamento.** Cada teste cria seus próprios dados e registra os IDs via fixture `pet_tracker`. No teardown, a fixture executa deleção em cascata (`Pet → Document → Job`) garantindo que nenhum dado persista entre testes.

### Cobertura de Testes (44 testes)

| Categoria | Testes | O que cobrem |
|-----------|--------|-------------|
| **Health** | 1 | Verificação de integridade da API |
| **Database** | 2 | Conexão, lifecycle completo (Pet→Doc→Job), cascade delete |
| **Pets** | 9 | Criação, validação (campos obrigatórios, whitespace), GET por ID, 404, listagem, paginação (skip/limit), pet com documents |
| **Documents** | 21 | Upload .txt/.pdf, extensões inválidas (415), pet inexistente (404), arquivo grande (413), arquivo vazio (422), boundary 10MB exato, múltiplos uploads, GET pendente/ready/failed/404, upload sem arquivo, fluxo ponta-a-ponta |
| **Jobs** | 10 | DONE com sucesso, FAILED com sucesso, job inexistente (404), idempotência DONE/FAILED, conflito DONE→FAILED (409), conflito FAILED→DONE (409), status inválido (422), DONE sem summary, FAILED sem error |
| **Polling** | 6 | Retorno imediato (DONE), conclusão concorrente (DONE), conclusão concorrente (FAILED), timeout 204, condição `after_job_id`, `after_job_id` negativo (422), documento inexistente (404) |

### Categorias de Teste

* **Happy Path:** fluxo principal funciona corretamente
* **Error Handling:** códigos HTTP previsíveis (404, 409, 413, 415, 422) — sem 500 para erros de domínio
* **Idempotência:** chamadas duplicadas ao worker retornam 200 sem alterar dados
* **Conflito de Estado:** transições proibidas (DONE→FAILED, FAILED→DONE) retornam 409
* **Boundary Testing:** arquivo exatamente no limite de 10 MB, `after_job_id` negativo
* **Edge Cases:** payloads incompletos do worker (DONE sem summary, FAILED sem error)
* **Concorrência:** poll + worker simultâneo via `asyncio.gather`
* **Fluxo Ponta-a-Ponta:** criar pet → upload → worker → consulta com todos os campos de observabilidade
