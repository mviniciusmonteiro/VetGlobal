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
| Frontend (Bônus) | React + Vite + TypeScript | SPA com Simulador de Worker interativo |

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

### 2. Execução Local Completa (Backend + Frontend)

Para executar os serviços localmente no seu ambiente de desenvolvimento:

#### Pré-requisitos
* **Python 3.11+**
* **Node.js 18+** e **npm**
* **PostgreSQL ativo e rodando localmente**

---

#### Passo 1: Banco de Dados (PostgreSQL)

Certifique-se de que o serviço do PostgreSQL esteja ativo e crie a base de dados para a aplicação:

```sql
CREATE DATABASE vetglobal;
```
*(Opcional: para executar os testes automatizados localmente, crie também a base `CREATE DATABASE vetglobal_test;`)*

---

#### Passo 2: Backend (FastAPI)

1. **Clone o repositório e acesse a raiz:**
   ```bash
   git clone https://github.com/mviniciusmonteiro/VetGlobal.git
   cd VetGlobal
   ```

2. **Crie e ative o ambiente virtual:**
   ```bash
   # No Windows (PowerShell):
   python -m venv venv
   .\venv\Scripts\activate

   # No Linux/Mac:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure o arquivo `.env`:**
   Crie um arquivo `.env` na raiz do projeto (baseando-se no `.env.example`) com suas credenciais do PostgreSQL local:
   ```env
   APP_NAME=VetGlobal
   ENVIRONMENT=development
   DEBUG=True

   DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/vetglobal

   POLL_TIMEOUT_SECONDS=25
   POLL_INTERVAL_SECONDS=1
   ```

5. **Inicie o servidor da API:**
   ```bash
   uvicorn app.main:app --reload
   ```
   > A API estará rodando em **[http://localhost:8000](http://localhost:8000)** e a documentação interativa em **[http://localhost:8000/docs](http://localhost:8000/docs)**.

---

#### Passo 3: Frontend (React + Vite)

Em um novo terminal, acesse a pasta `frontend` e execute:

```bash
# Acesse o diretório do frontend
cd frontend

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

> A interface web estará acessível em **[http://localhost:5173](http://localhost:5173)**.  
> Para mais detalhes sobre a interface, consulte o [README do Frontend](frontend/README.md).

---

## Testes Automatizados

```bash
# Localmente:
pytest -v

# Ou isolado via container Docker:
docker compose run --rm test
```

### Estratégia de Testes

* **PostgreSQL Real (`vetglobal_test`):** Todos os testes rodam contra uma instância real de banco, garantindo fidelidade total de tipos (`BYTEA`), constraints e isolamento transacional *(detalhes no [Trade-off 4](#4-testes-automatizados-postgresql-real-vs-sqlite-em-memória))* .
* **Polling acelerado em testes:** O `conftest.py` sobrescreve os tempos para `POLL_TIMEOUT_SECONDS=2` e `POLL_INTERVAL_SECONDS=0.1`, garantindo que os 50 testes rodem em ~10 segundos sem modificar a lógica da API.
* **Concorrência real:** Testes assíncronos com `asyncio.gather` e `httpx.AsyncClient` disparam simultaneamente requisições de polling e callbacks de worker para certificar que o polling desbloqueia reativamente.
* **Isolamento de dados:** Cada teste registra seus IDs na fixture `pet_tracker`, que executa deleção em cascata (`Pet → Document → Job`) no teardown, garantindo zero contaminação entre testes.

### Cobertura de Testes (50 testes)

| Categoria | Qtd | O que cobrem |
|-----------|-----|-------------|
| **Health** | 1 | Verificação de integridade da API (`GET /health`) |
| **Database** | 2 | Conexão física com PostgreSQL, integridade relacional (`Pet → Document → Job`) e cascade delete |
| **Pets** | 10 | Criação com sucesso, sanitização de strings, validações de campos vazios/obrigatórios (422), consulta por ID (200/404), listagem geral, paginação (`skip`/`limit`) e integridade com documentos vinculados |
| **Documents** | 18 | Upload `.txt`/`.pdf`, extensões não suportadas (415), pet inexistente (404), arquivo > 10 MB (413), boundary exato de 10 MB (202), arquivo vazio (422), payload sem arquivo (422), múltiplos uploads, consultas de status (`PENDING`/`READY`/`FAILED`), deduplicação SHA-256 com idempotência transparente e isolamento estrito entre pets |
| **Polling** | 7 | Retorno imediato quando já concluído, conclusão concorrente via `asyncio.gather` (`DONE`/`FAILED`), timeout 204 No Content, filtro condicional `after_job_id`, validação de input negativo (422) e 404 imediato para documento inexistente |
| **Jobs** | 12 | Conclusão normal (`DONE`/`FAILED`), job inexistente (404), idempotência sequencial e concorrente (*first write wins*) com Lock Pessimista (`with_for_update`), rejeição de conflito de estado (409), status inválido (422) e tolerância a payloads parciais |

A suíte abrange testes de *Happy Path*, limites (*Boundary Testing* de 10 MB), concorrência real (`asyncio.gather`), resiliência a falhas (sem nenhum `500`), idempotência transacional e fluxos ponta-a-ponta completos. Para a especificação detalhada de cada caso de teste e cenários avaliados, consulte o [Plano de Testes](docs/plano_de_testes.md).

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

> [!TIP]
> **Como testar o fluxo assíncrono na prática:**
> * **Visualmente (Recomendado):** Acesse a interface web em [http://localhost:5173](http://localhost:5173). Ela possui um **Simulador de Worker** integrado que permite realizar o upload, observar o long polling em tempo real e disparar a conclusão (`DONE` com laudo) ou falha (`FAILED`) com um único clique.
> * **Via Linha de Comando:** Siga os comandos ponta a ponta prontos no [Guia de Execução via cURL](docs/guia_de_execucao_curl.md).

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
| `POST` | `/pets/{pet_id}/documents` | Upload de documento (.txt/.pdf, ≤ 10 MB) com deduplicação | 202 / 200 |
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

### Mecânica de Execução & Comportamento HTTP

* **Semântica de Timeout (`204 No Content` vs `200 null`):** O status `204` comunica explicitamente que o tempo de espera expirou sem conclusão, dispensando o cliente de inspecionar o corpo da resposta para distinguir entre timeout e dados prontos.
* **Prevenção de Threadpool Starvation (`async def` + `run_in_threadpool`):** O loop de espera é suspenso no Event Loop (`await asyncio.sleep`), sem reter threads do sistema operacional. As queries do SQLAlchemy são despachadas via `run_in_threadpool` apenas pelos milissegundos pontuais do `SELECT`.
* **Invalidação do Cache L1 do ORM (`db.expire_all()`):** O SQLAlchemy retém instâncias no seu *Identity Map* em memória. A chamada explícita a `db.expire_all()` a cada iteração força a leitura do estado fresco commitado pelo worker no PostgreSQL, prevenindo falsos timeouts.

> *(Para a análise comparativa de arquitetura sob múltiplas instâncias entre Long Polling, `asyncio.Event()` e WebSockets, consulte a seção [Trade-offs Técnicos](#3-estratégia-de-polling-long-polling-no-banco-vs-asyncioevent-vs-websockets)).*

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

**Concorrência segura:** O endpoint aplica **Lock Pessimista (`SELECT ... FOR UPDATE`)** via `with_for_update()`, serializando finalizações concorrentes no PostgreSQL antes de validar as transições *(veja a defesa do Lock Pessimista frente ao Lock Otimista no [Trade-off 1](#1-concorrência-de-workers-lock-pessimista-with_for_update-vs-lock-otimista))* .

### Upload de Documentos e Deduplicação por Hash SHA-256

A API implementa **Deduplicação Inteligente com Idempotência Transparente**:

* **Hash SHA-256:** Ao receber o arquivo, calcula-se o hash criptográfico do conteúdo e verifica-se a existência prévia na base através de um índice composto `(pet_id, file_hash)`.
* **Idempotência Transparente (`PENDING` ou `READY`):** Se o mesmo arquivo for enviado novamente para o mesmo pet enquanto pendente (`PENDING`), retorna o `job_id` existente com `202 Accepted` (`is_duplicate: true`), prevenindo sobrecarga de workers. Se o documento já estiver concluído (`READY`), retorna `200 OK` imediatamente com o resumo pronto, dispensando o polling.
* **Capacidade de Retry (`FAILED`):** Se a execução anterior falhou, o arquivo é liberado para novo upload (`is_duplicate: false`), gerando um novo `Job` para reprocessamento.
* **Isolamento por Paciente:** A verificação é escopada ao `pet_id`. Uploads do mesmo termo ou exame para pets diferentes geram registros independentes, mantendo a privacidade e integridade dos prontuários.

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

## Trade-offs Técnicos & Decisões de Engenharia

Toda decisão de arquitetura em sistemas distribuídos envolve compromissos (*trade-offs*). As principais escolhas técnicas do projeto foram desenhadas para equilibrar robustez, simplicidade de execução e fidelidade a padrões de produção:

### 1. Concorrência de Workers: Lock Pessimista (`with_for_update`) vs. Lock Otimista
* **Decisão:** O endpoint `/internal/jobs/{id}/complete` utiliza `SELECT ... FOR UPDATE` diretamente no PostgreSQL para travar a linha do Job durante a transição de estado.
* **Por quê:** Garante que callbacks simultâneos de workers (ou retries rápidos após timeout de rede) sejam serializados no banco com isolamento transacional estrito. Isso assegura idempotência (*first write wins*) e impede transições conflitantes (retornando `409 Conflict` deterministicamente).
* **Trade-off assumido:** Locks de linha prendem recursos da conexão durante a transação; por isso, a lógica do endpoint foi mantida estritamente enxuta e sem chamadas bloqueantes de rede para liberar o lock em poucos milissegundos.

### 2. Armazenamento de Binários: `BYTEA` no PostgreSQL vs. Object Storage (S3)
* **Decisão:** Os arquivos clínicos (≤ 10 MB) são persistidos diretamente na coluna `BYTEA` da tabela `documents`.
* **Por quê:** Garante **atomicidade ACID pura**: o arquivo, o registro do documento e o job de processamento são gravados na mesma transação. Se qualquer validação falhar, o rollback é instantâneo e não há risco de arquivos órfãos. Além disso, torna o repositório 100% autocontido no Docker, sem depender de mocks locais de S3 (como LocalStack) ou credenciais de nuvem externa.
* **Trade-off assumido:** Armazenar arquivos volumosos no PostgreSQL aumenta o consumo do *Buffer Pool* (RAM) do banco. Em ambiente de alta escala com arquivos pesados, a evolução padrão é delegar o upload diretamente ao **AWS S3 / Cloudflare R2** via *Presigned URLs*.

### 3. Estratégia de Polling: Long Polling no Banco vs. `asyncio.Event()` vs. WebSockets
* **Decisão:** Implementação de Long Polling com `async def`, suspensão no Event Loop (`await asyncio.sleep`) e consultas pontuais no banco via `run_in_threadpool`.
* **Por quê:** A API é **100% Stateless**. Estruturas de sincronização em memória (como `asyncio.Event` ou dicionários globais) quebram imediatamente se a aplicação rodar com múltiplos pods ou réplicas atrás de um Load Balancer, pois o evento ficaria confinado à memória de um único processo. O PostgreSQL atua como fonte centralizada de verdade.
* **Trade-off assumido:** Gera consultas periódicas ao banco durante a espera; em produção com centenas de milhares de conexões abertas, o polling deve ser substituído por uma arquitetura reativa (*Event-Driven*) com **PostgreSQL `LISTEN/NOTIFY`** ou **WebSockets / SSE** via Redis Pub/Sub.

### 4. Testes Automatizados: PostgreSQL Real vs. SQLite em Memória
* **Decisão:** Toda a suíte de testes (50 testes) executa contra um **PostgreSQL real** (`vetglobal_test`), tanto localmente quanto no container Docker.
* **Por quê:** SQLite não suporta locks de linha (`with_for_update`), não reproduz o isolamento transacional concorrente do PostgreSQL e difere na tipagem binária (`BYTEA`). Testar contra o mesmo motor de produção evita surpresas e garante que a concorrência real funcione.
* **Trade-off assumido:** Exige o serviço do PostgreSQL ativo para rodar os testes e pequena latência adicional de I/O, compensada pela fixture `pet_tracker` com limpeza em cascata rápida e redução dos intervalos de polling em tempo de teste (`conftest.py`).

### 5. Gestão de Schema: `create_all()` no Lifespan vs. Migrações (Alembic)
* **Decisão:** Criação automatizada de tabelas via `Base.metadata.create_all()` no startup da aplicação.
* **Por quê:** Proporciona experiência de avaliação imediata ("clone and run") sem exigir comandos adicionais de migração manual na primeira inicialização.
* **Trade-off assumido:** Não suporta alterações incrementais de colunas nem rollback de schema em produção contínua, onde o versionamento formal com **Alembic** acoplado ao pipeline de CI/CD (padrão *Expand/Contract*) é indispensável.

### 6. Observabilidade Nativa sem Ferramentas Externas
* **Decisão:** Registro explícito de `completed_at` no Job e cálculo em tempo de consulta de `duration_ms` exposto no contrato de `GET /documents/{id}`.
* **Por quê:** Disponibiliza métricas de SLA e tempo de resposta diretamente para o frontend e clientes da API sem a sobrecarga operacional de configurar agentes de APM ou tracing distribuído (OpenTelemetry/Jaeger) no escopo inicial.

---

## Delimitação de Escopo & Roadmap de Produção (Intencionalmente Fora do Escopo)

A estratégia de desenvolvimento priorizou o pipeline assíncrono de ponta a ponta com banco real e testes rigorosos de concorrência, mantendo a base de código enxuta e desacoplada para evolução contínua:

| Componente | Decisão Estratégica no Projeto (Escopo Atual) | Arquitetura Alvo no Roadmap de Produção |
| :--- | :--- | :--- |
| **Autenticação & RBAC** | Não implementado | Middleware JWT/OAuth2 com controle de acesso baseado em papéis (*Role-Based Access Control*) |
| **Multi-tenancy** | Modelagem relacional direta e simplificada por paciente | Adição de `tenant_id` em todas as tabelas com *Row-Level Security* (RLS) no PostgreSQL |
| **Broker de Mensageria** | PostgreSQL como fonte única da verdade (zero dependência externa) | Desacoplamento via **AWS SQS / RabbitMQ / Celery** com Dead-Letter Queues (DLQ) |
| **Processamento de IA** | Callback determinístico via webhook interno para simulação e testes | Worker assíncrono com OCR e sumarização via LLMs (OpenAI, Claude ou Gemini) |
| **Armazenamento de Binários** | Coluna `BYTEA` (≤ 10 MB) com atomicidade transacional pura | Upload direto para **AWS S3 / Cloudflare R2** via Presigned URLs |
| **Migrações de Schema** | `Base.metadata.create_all()` no ciclo de vida da aplicação | Versionamento formal de schema com **Alembic** integrado ao pipeline de CI/CD |
| **Comunicação Reativa** | Long Polling stateless compatível com qualquer cliente HTTP | Arquitetura *Event-Driven* via **WebSockets / SSE** ou **PostgreSQL `LISTEN/NOTIFY`** |

---

## Documentação Complementar

Para uma análise aprofundada da arquitetura, do plano de desenvolvimento, testes e exemplos via terminal, consulte os documentos detalhados na pasta `docs/`:

* [Plano de Testes](docs/plano_de_testes.md) — Matriz formal dos 50 testes automatizados, estratégia de isolamento térmico (`pet_tracker`), concorrência real e critérios de aceite.
* [Plano de Implementação & Matriz de Requisitos](docs/plano_de_implementacao.md) — Cronologia das 12 fases, metodologia de desenvolvimento iterativo e rastreabilidade de conformidade.
* [Engenharia, Arquitetura e Decisões Técnicas](docs/engenharia_e_decisoes.md) — Prevenção de Threadpool Starvation, controle de cache L1 do Identity Map (`db.expire_all()`), persistência ACID em BYTEA, resiliência de pool e idempotência.
* [Guia de Execução via cURL](docs/guia_de_execucao_curl.md) — Fluxo passo a passo de requisições prontas para teste rápido via linha de comando.


