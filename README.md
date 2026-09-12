# VetGlobal — Diagnóstico & Prontuário Clínico Veterinário

API assíncrona para gerenciamento de pets e processamento de documentos clínicos veterinários.

O sistema recebe cadastros e arquivos de prontuários clínicos, cria tarefas de processamento em segundo plano (Jobs) e disponibiliza endpoints para acompanhamento assíncrono de status e sumarização via long polling.

---

## Tecnologias

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework Web | FastAPI | >= 0.110 |
| Servidor ASGI | Uvicorn | >= 0.28 |
| ORM | SQLAlchemy 2.0 | >= 2.0.28 |
| Banco de Dados | PostgreSQL | 16 |
| Validação | Pydantic v2 | >= 2.6 |
| Testes | Pytest + httpx + pytest-asyncio | >= 8.1 |
| Containerização | Docker Compose | v2 |
| Frontend (Bônus) | React + Vite + TypeScript | — |

---

## Como Executar o Projeto

### 1. Execução via Docker Compose (Recomendado)

Sobe toda a infraestrutura (PostgreSQL + FastAPI + Frontend React) com um único comando, sem necessidade de configuração manual de banco ou dependências:

```bash
# Clone o repositório
git clone https://github.com/mviniciusmonteiro/VetGlobal.git
cd VetGlobal

# Inicie todos os serviços
docker compose up --build
```

O script `scripts/init-db.sh` cria automaticamente os bancos `vetglobal` e `vetglobal_test` na inicialização do container PostgreSQL.

Acessos disponíveis:
* **Frontend Web (SPA):** [http://localhost:5173](http://localhost:5173)
* **API Backend:** [http://localhost:8000](http://localhost:8000)
* **Swagger UI (Docs Interativas):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

### 2. Execução Local (Alternativa)

#### Pré-requisitos
* Python 3.11+
* PostgreSQL ativo e rodando

#### Instalação

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

#### Configuração do Ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
APP_NAME=VetGlobal
ENVIRONMENT=development
DEBUG=True

DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/vetglobal

POLL_TIMEOUT_SECONDS=25
POLL_INTERVAL_SECONDS=1
```

#### Iniciar o Servidor

```bash
uvicorn app.main:app --reload
```

---

## Testes Automatizados

```bash
# Localmente:
pytest -v

# Ou isolado via container Docker:
docker compose run --rm test
```

### Estratégia de Testes

**Banco real, não SQLite.** Todos os testes rodam contra um **PostgreSQL real** (banco `vetglobal_test`), não SQLite em memória. SQLite não reproduz fielmente comportamentos de locks, tipos e concorrência do PostgreSQL — testar contra o mesmo banco de produção evita surpresas.

**Polling rápido nos testes.** O timeout de 25s tornaria a suíte lenta. O `conftest.py` sobrescreve para `POLL_TIMEOUT_SECONDS=2` e `POLL_INTERVAL_SECONDS=0.1`, garantindo testes rápidos sem alterar a lógica.

**Concorrência real.** Os testes de polling concorrente usam `asyncio.gather` com `httpx.AsyncClient` para disparar simultaneamente uma requisição de poll e uma chamada do worker, validando que o poll é desbloqueado corretamente.

**Isolamento.** Cada teste cria seus próprios dados e registra os IDs via fixture `pet_tracker`. No teardown, a fixture executa deleção em cascata (`Pet → Document → Job`) garantindo que nenhum dado persista entre testes.

### Cobertura de Testes (44 testes)

| Categoria | Qtd | O que cobrem |
|-----------|-----|-------------|
| **Health** | 1 | Verificação de integridade |
| **Database** | 2 | Conexão, lifecycle completo (Pet→Doc→Job), cascade delete |
| **Pets** | 9 | Criação, validação, GET, 404, listagem, paginação, pet com documents |
| **Documents** | 21 | Upload .txt/.pdf, extensões inválidas (415), pet inexistente (404), arquivo grande (413), arquivo vazio (422), boundary 10 MB, múltiplos uploads, GET por status, upload sem arquivo, fluxo ponta-a-ponta |
| **Jobs** | 10 | DONE/FAILED, 404, idempotência, conflito de estado (409), status inválido (422), DONE sem summary, FAILED sem error |
| **Polling** | 6 | Retorno imediato, conclusão concorrente (DONE/FAILED), timeout 204, condição `after_job_id`, input negativo (422), documento inexistente (404) |

### Categorias de Teste

* **Happy Path** — fluxo principal funciona corretamente
* **Error Handling** — códigos HTTP previsíveis (404, 409, 413, 415, 422) sem 500
* **Idempotência** — chamadas duplicadas ao worker retornam 200 sem alterar dados
* **Conflito de Estado** — transições proibidas (DONE→FAILED) retornam 409
* **Boundary Testing** — arquivo exatamente no limite de 10 MB
* **Edge Cases** — payloads incompletos do worker
* **Concorrência** — poll + worker simultâneo via `asyncio.gather`
* **Fluxo Ponta-a-Ponta** — criar pet → upload → worker → consulta com observabilidade

Para a especificação detalhada de cada caso de teste, cenários negativos e critérios de qualidade, consulte o [Plano de Testes](docs/plano_de_testes.md).

---

## Arquitetura

### Organização do Código

O projeto segue separação em camadas com responsabilidades bem definidas:

```
app/
├── api/
│   ├── endpoints/       # Routers — responsáveis apenas por HTTP (status codes, serialização)
│   │   ├── pets.py
│   │   ├── documents.py
│   │   └── jobs.py
│   └── router.py        # Agregador de sub-routers
├── core/
│   └── config.py        # Settings centralizadas via Pydantic BaseSettings
├── db/
│   ├── base.py          # DeclarativeBase do SQLAlchemy
│   └── session.py       # Engine, SessionLocal e dependency get_db
├── models/              # Modelos SQLAlchemy (ORM → tabelas PostgreSQL)
│   ├── pet.py
│   ├── document.py
│   └── job.py
├── schemas/             # Schemas Pydantic (contratos de entrada/saída da API)
│   ├── pet.py
│   ├── document.py
│   └── job.py
├── services/            # Regras de negócio — sem acoplamento a HTTP
│   ├── pet_service.py
│   ├── document_service.py
│   └── job_service.py
└── main.py              # Entrypoint: FastAPI app, lifespan, CORS, routers
```

**Princípio:** Routers tratam HTTP. Services tratam regras de negócio. Models tratam persistência. Nenhuma camada invade a responsabilidade da outra.

### Relacionamentos no Banco

```
Pet
 │
 └─── 1:N ─── Document
                  │
                  └─── 1:N ─── Job
```

### Infraestrutura Docker

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React + Vite   │     │     FastAPI       │     │   PostgreSQL 16  │
│   :5173          │────▶│     :8000         │────▶│   :5432          │
│   (Frontend)     │     │     (API)         │     │   (Banco)        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                                                  ┌───────┴────────┐
                                                  │ vetglobal      │
                                                  │ vetglobal_test │
                                                  └────────────────┘
```

---

## Workflow Assíncrono

O fluxo de processamento simula o pipeline real da VetGlobal:

```
1. Cliente cria Pet
   POST /pets
       │
       ▼
2. Cliente faz upload de documento clínico (.txt ou .pdf)
   POST /pets/{pet_id}/documents
       │
       ├── Document criado (status: PENDING)
       ├── Job criado (status: ENQUEUED)
       └── Retorna HTTP 202 Accepted + document_id + job_id
       │
       ▼
3. Cliente inicia Long Polling para acompanhar o processamento
   GET /documents/{document_id}/poll?after_job_id={job_id}
       │
       ▼
4. Worker conclui o processamento (simulado)
   POST /internal/jobs/{job_id}/complete
       │
       ├── Sucesso: Job → DONE, Document → READY + summary
       └── Falha:   Job → FAILED, Document → FAILED + error
       │
       ▼
5. Polling é desbloqueado e retorna o resultado ao cliente
```

O banco PostgreSQL é a **única fonte de verdade** do estado de processamento. Nenhuma instância da API retém estado em memória — o design é 100% stateless.

---

## Endpoints da API

### Pets

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| `POST` | `/pets` | Cadastrar novo pet | 201 Created |
| `GET` | `/pets/{pet_id}` | Consultar pet por ID | 200 / 404 |
| `GET` | `/pets?skip=0&limit=100` | Listar pets com paginação | 200 |

### Documents

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| `POST` | `/pets/{pet_id}/documents` | Upload de documento (.txt/.pdf, ≤ 10 MB) | 202 Accepted |
| `GET` | `/documents/{document_id}` | Consultar estado e resultado do documento | 200 / 404 |
| `GET` | `/documents/{document_id}/poll?after_job_id=0` | Long polling (até 25s) | 200 / 204 / 404 |

### Jobs (Internal)

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| `POST` | `/internal/jobs/{job_id}/complete` | Callback do worker (DONE/FAILED) | 200 / 404 / 409 |

### Health

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| `GET` | `/health` | Verificação de integridade | 200 |

---

## Estratégia de Polling

O endpoint `GET /documents/{document_id}/poll` implementa **long polling stateless** com as seguintes características:

```
Request chega
   │
   ▼
Documento existe? ──── Não ──► 404 Not Found (imediato)
   │
   Sim
   │
   ▼
┌─────────────────────────────────────┐
│  Loop (até 25 segundos):            │
│                                     │
│  Consultar PostgreSQL:              │
│  job.id >= after_job_id             │
│  AND job.status IN (DONE, FAILED)?  │
│                                     │
│  ├── Sim ──► 200 OK + documento     │
│  │                                  │
│  └── Não ──► await asyncio.sleep()  │
│              (0.5s, não bloqueia    │
│               nenhuma thread)       │
└─────────────────────────────────────┘
   │
   ▼ (timeout)
204 No Content
```

### Decisões técnicas do polling

**Por que `204 No Content` no timeout (e não `200 null`)?**
O `204` comunica semanticamente que "não há conteúdo para retornar" sem ambiguidade. O cliente distingue facilmente timeout (204) de resultado (200) sem inspecionar o body.

**Por que polling no banco e não `asyncio.Event()` em memória?**
Estruturas em memória quebram em arquitetura multi-instância. Se o `POST /internal/jobs/{id}/complete` é processado na Instância B e o `GET .../poll` aguarda na Instância A, a Instância A nunca seria notificada. O PostgreSQL é a única fonte de verdade compartilhada.

**Por que `async def` + `run_in_threadpool` (e não rota síncrona)?**
Em rotas síncronas (`def`) com `time.sleep()`, cada requisição de poll prenderia uma thread do threadpool por até 25s. Com o pool padrão de ~40 threads, apenas 40 clientes simultâneos congelariam a API inteira. A solução:
- `async def` → a espera é suspensa no Event Loop (`await asyncio.sleep`), sem consumir threads
- `run_in_threadpool` → a query síncrona do SQLAlchemy pega uma thread apenas pelos milissegundos do `SELECT`

**Evolução para produção:**
Em escala massiva, a evolução recomendada é substituir o polling por `LISTEN/NOTIFY` do PostgreSQL ou WebSockets, eliminando as queries periódicas.

---

## Idempotência

### Job Completion

O endpoint `POST /internal/jobs/{job_id}/complete` implementa idempotência para proteger contra retries do worker:

```
Worker envia status X para Job J
  │
  ├── J em andamento (ENQUEUED/PROCESSING)
  │     → Transiciona para X. Retorna 200 OK.
  │
  ├── J já terminal E mesmo status X
  │     → No-op. Retorna 200 OK. (IDEMPOTENTE — first write wins)
  │
  └── J já terminal E status DIFERENTE
        → Rejeita. Retorna 409 Conflict.
```

**Cenário real:** Se a rede cai após o worker enviar DONE mas antes de receber o 200, ele reenvia. A segunda chamada retorna 200 sem alterar dados — o worker fica satisfeito sem duplicar efeitos.

**Nota sobre concorrência:** A implementação não usa `SELECT ... FOR UPDATE` (lock pessimista). Em um sistema com um único worker por job, isso é aceitável. Em produção com workers concorrentes, seria necessário lock pessimista ou optimistic locking com coluna de versão.

### Upload de Documentos

Múltiplos uploads para o mesmo pet são **permitidos**. Cada upload gera um novo `Document` + `Job` independente. Justificativa: um pet pode ter múltiplos prontuários clínicos ao longo do tempo. Deduplicação por hash de conteúdo seria over-engineering para o escopo.

---

## Error Handling

A API retorna códigos HTTP previsíveis para todos os erros de domínio. Nenhum erro previsível resulta em `500 Internal Server Error`.

| Código | Significado | Quando ocorre |
|--------|-------------|---------------|
| `404` | Not Found | Pet, documento ou job inexistente |
| `409` | Conflict | Tentativa de alterar job já finalizado para status diferente |
| `413` | Payload Too Large | Arquivo excede 10 MB |
| `415` | Unsupported Media Type | Extensão diferente de `.txt` ou `.pdf` |
| `422` | Unprocessable Entity | Dados inválidos (Pydantic), arquivo vazio, campo obrigatório ausente |

Exceções de domínio customizadas (`PetNotFoundError`, `FileSizeExceededError`, `JobTerminalStateConflictError` etc.) são lançadas nos services e mapeadas para HTTP codes nos routers, mantendo a separação de responsabilidades.

---

## Decisões Técnicas e Trade-offs

### Armazenamento de Arquivos: BYTEA no PostgreSQL

| Decisão | Justificativa |
|---------|---------------|
| Arquivos armazenados como `BYTEA` no PostgreSQL (≤ 10 MB) | API 100% stateless — múltiplas instâncias compartilham o mesmo storage sem volumes NFS/EFS |
| Arquivo + metadados na mesma transação (ACID) | Sem risco de arquivos órfãos em disco se o commit falhar |
| Alinhado ao design stateless do polling | Fonte única de verdade no PostgreSQL |
| **Trade-off** | Em produção com arquivos grandes (vídeos, imagens de alta resolução), migraria para S3/GCS com URLs pré-assinadas |

### Simulação da Fila: Banco como Fonte de Verdade

O banco PostgreSQL representa o estado do processamento assíncrono. Não foi utilizada uma fila real (Redis, RabbitMQ, SQS). A transição de estados do Job (`ENQUEUED → DONE/FAILED`) ocorre via endpoint `/internal/jobs/{id}/complete`, que simula o callback de um worker.

Incompatível com múltiplas instâncias da API:
```python
# Exemplo que quebraria com múltiplas instâncias da API
jobs = {}  # estado perdido entre réplicas
asyncio.Event()  # evento local, invisível para outras instâncias
```

**Trade-off:** Em produção, utilizaria uma fila real (SQS, RabbitMQ) com workers consumindo mensagens e chamando o endpoint de completion.

### Estado `PROCESSING` — Por que não é usado

O modelo `Job` define o estado `PROCESSING`, mas o fluxo atual transiciona direto de `ENQUEUED` para `DONE/FAILED`. Isso é intencional: como o worker é simulado por um callback HTTP (não há um worker real consumindo uma fila), não existe o momento de "pegar o job" que marcaria `PROCESSING`. O estado está modelado para extensibilidade futura com workers reais.

### Payloads Opcionais no Worker

O worker pode enviar `DONE` sem `summary` ou `FAILED` sem `error`. Ambos os campos são `Optional` no schema. A API aceita esses casos porque:
- O contrato é do worker — forçar campos quebraria retries parciais
- Em produção, adicionaria warning logs para monitoramento de qualidade dos dados

---

## Access Control e Tenant Isolation

**Não implementado** (fora do escopo do projeto).

Em produção, a abordagem seria:
- Adicionar `tenant_id` como FK em `Pet` e `Document`, extraído de um JWT no middleware
- Filtrar todas as queries por `tenant_id` para garantir isolamento
- Proteger o endpoint `/internal/jobs/{id}/complete` com API key ou service mesh interno, impedindo acesso público

---

## Observabilidade

O campo `completed_at` no modelo `Job` registra o timestamp UTC de conclusão. Com base nele, o response de `GET /documents/{id}` expõe:

- `completed_at` — quando o processamento terminou
- `duration_ms` — duração total do processamento em milissegundos (`completed_at - created_at`)

Esses campos permitem monitorar a latência dos jobs e detectar degradação de performance sem necessidade de ferramentas externas de tracing.

---

## Intencionalmente Fora do Escopo

| Item | Motivo |
|------|--------|
| Autenticação e autorização | Não requerido pelo enunciado. Documentada abordagem futura |
| Multi-tenancy | Documentada abordagem futura (tenant_id + JWT) |
| Fila real (Redis/RabbitMQ/SQS) | Banco como fonte de verdade é suficiente para o escopo |
| LLM real para sumarização | Worker simulado via callback HTTP |
| Object Storage (S3/GCS) | BYTEA ≤ 10 MB atende ao escopo com atomicidade ACID |
| Alembic Migrations | `create_all()` no lifespan é suficiente para demonstração |
| Kubernetes / Distributed Tracing | Fora do escopo operacional |
| LISTEN/NOTIFY do PostgreSQL | Polling no banco é documentado como trade-off |

---

## Documentação Complementar

Para uma análise aprofundada da arquitetura, do plano de desenvolvimento, testes e exemplos via terminal, consulte os documentos detalhados na pasta `docs/`:

* [Plano de Testes](docs/plano_de_testes.md) — Matriz formal dos 44 testes automatizados, estratégia de isolamento térmico (`pet_tracker`), concorrência real e critérios de aceite.
* [Plano de Implementação & Matriz de Requisitos](docs/plano_de_implementacao.md) — Cronologia das 12 fases, metodologia de desenvolvimento iterativo e rastreabilidade de conformidade.
* [Engenharia, Arquitetura e Decisões Técnicas](docs/engenharia_e_decisoes.md) — Prevenção de Threadpool Starvation, controle de cache L1 do Identity Map (`db.expire_all()`), persistência ACID em BYTEA, resiliência de pool e idempotência.
* [Guia de Execução via cURL](docs/guia_de_execucao_curl.md) — Fluxo passo a passo de requisições prontas para teste rápido via linha de comando.


