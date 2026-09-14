# Plano de Implementação — VetGlobal Backend

Este documento sintetiza o plano de engenharia adotado no desenvolvimento do VetGlobal Backend, apresentando a metodologia iterativa de entrega, a cronologia das fases de implementação e a matriz de validação dos requisitos.

---

## Metodologia e Princípios de Entrega

O desenvolvimento seguiu a metodologia **Risk-First / Walking Skeleton**:

1. **Prioridade para o fluxo ponta a ponta:** Construir primeiro a espinha dorsal da aplicação (Pet → Upload → Job → Worker → Polling → Resposta).
2. **Stateless por design:** Nenhuma camada retém estado de processamento em memória; o PostgreSQL atua como fonte única da verdade.
3. **Complexidade sob demanda:** Evitar introduzir ferramentas distribuídas pesadas (RabbitMQ, Redis, Celery, S3) quando os requisitos de negócio são atendidos com máxima robustez, garantias transacionais e menor custo operacional via PostgreSQL bem estruturado.
4. **Validação orientada a testes:** Cada nova funcionalidade é entregue acompanhada de testes unitários e de integração contra banco de dados real.

---

## Cronologia das Fases de Implementação

```
Fase 1: Setup & Baseline
   │
   ▼
Fase 2: Banco de Dados & Modelos Relacionais
   │
   ▼
Fase 3: Gestão de Pets (CRUD & Validações)
   │
   ▼
Fases 4 e 5: Upload de Documentos & Fila de Jobs (Persistência Atômica)
   │
   ▼
Fase 6: Simulação de Worker & Idempotência
   │
   ▼
Fase 7: Consulta de Documentos & Observabilidade
   │
   ▼
Fase 8: Long Polling Stateless & Concorrência Segura
   │
   ▼
Fase 9: Suíte de Testes Automatizados (Happy Path, Edge Cases & Race Conditions)
   │
   ▼
Fase 10: Containerização Docker & Orquestração Multi-serviço
   │
   ▼
Fase 11: Documentação Técnica & Defesa de Decisões
   │
   ▼
Fase 12: Revisão Final de Conformidade & Frontend SPA (Bônus)
```

---

## Detalhamento das Fases

### Fase 1 — Setup & Estrutura Inicial
* Configuração do interpretador Python 3.11+ e ambiente virtual.
* Definição de dependências estritas em `requirements.txt` (FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, Pytest, HTTPX).
* Criação da estrutura modular de diretórios (`app/api`, `app/core`, `app/db`, `app/models`, `app/schemas`, `app/services`).
* Implementação do endpoint de verificação de integridade: `GET /health`.

### Fase 2 — Persistência & Modelos ORM
* Criação da `Engine` SQLAlchemy com pool de conexões resiliente (`pool_pre_ping=True`).
* Implementação do gerador de sessões transacionais (`SessionLocal` e dependency `get_db`).
* Modelagem declarativa com tipos estritos (`Mapped[...]` e `mapped_column`):
  * **Pet:** id, name, owner_name, created_at.
  * **Document:** id, pet_id, filename, file_content (BYTEA), file_size, content_type, status, summary, error, created_at.
  * **Job:** id, document_id, status, error, created_at, completed_at.
* Configuração de integridade relacional com deleção em cascata (`ondelete="CASCADE"`).
* Inicialização do schema via lifespan context manager da aplicação.

### Fase 3 — Recurso de Pets
* Criação dos schemas Pydantic de entrada (`PetCreate`) e saída (`PetResponse`).
* Sanitização automática de inputs (remoção de espaços em branco antes e depois das strings).
* Implementação das rotas:
  * `POST /pets` (201 Created com retorno do ID gerado).
  * `GET /pets/{pet_id}` (200 OK ou 404 Not Found).
  * `GET /pets` (200 OK com suporte a paginação `skip` e `limit`).
* Isolamento de regras no `pet_service.py` sem dependência do contexto HTTP.

### Fases 4 e 5 — Upload de Documentos e Enfileiramento de Jobs
* Implementação da rota `POST /pets/{pet_id}/documents`.
* Validação precoce de extensão (`.txt` e `.pdf`), rejeitando formatos inválidos com status `415 Unsupported Media Type`.
* Verificação estrita de tamanho limite (≤ 10 MB), rejeitando sobrecargas com `413 Payload Too Large`.
* Validação contra payloads vazios (tamanho 0 bytes) retornando `422 Unprocessable Entity`.
* **Atomicidade Transacional:** O conteúdo binário do arquivo (`BYTEA`), o registro do `Document` (status `PENDING`) e o registro do `Job` (status `ENQUEUED`) são gravados na mesma transação atômica (`db.commit()`), garantindo ausência total de inconsistências.
* Resposta padronizada `202 Accepted` contendo `document_id`, `job_id` e status `ENQUEUED`.

### Fase 6 — Callback do Worker & Idempotência
* Criação do endpoint interno simulado `POST /internal/jobs/{job_id}/complete`.
* Tratamento de sucesso: transiciona `Job` para `DONE` e `Document` para `READY`, armazenando o `summary`.
* Tratamento de falha: transiciona `Job` para `FAILED` e `Document` para `FAILED`, armazenando o `error`.
* **Idempotência (First-Write-Wins):**
  * Se o worker retransmitir o mesmo status terminal para um job já concluído, a API retorna `200 OK` como operação neutra (no-op), protegendo contra retries de rede.
  * Se o worker tentar transicionar um job terminal para um status divergente (ex: `DONE` para `FAILED`), a API rejeita com `409 Conflict`.
* Suporte a payloads parciais do worker (campos `summary` e `error` opcionais sem quebrar contratos).
* **Lock Pessimista (`with_for_update`):** Consulta do Job protegida com `SELECT ... FOR UPDATE`, serializando chamadas concorrentes de workers diretamente no PostgreSQL.

### Fase 7 — Consulta de Documentos & Observabilidade
* Implementação da rota `GET /documents/{document_id}`.
* Mapeamento de status: `PENDING`, `READY` e `FAILED`.
* Inclusão de campos de observabilidade de performance no contrato de resposta:
  * `completed_at`: timestamp UTC da conclusão do processamento.
  * `duration_ms`: cálculo exato em milissegundos da duração da tarefa (`completed_at - created_at`).

### Fase 8 — Long Polling Stateless & Concorrência Segura
* Criação da rota reativa `GET /documents/{document_id}/poll?after_job_id=0`.
* Validação imediata: se o documento não existir, retorna `404 Not Found` sem entrar no loop de espera.
* Loop assíncrono controlado por `time.monotonic()` até o limite de 25 segundos (`POLL_TIMEOUT_SECONDS`).
* **Prevenção de Threadpool Starvation:**
  * Uso de rota `async def` para permitir que `await asyncio.sleep()` suspenda a execução no Event Loop sem ocupar threads do sistema operacional.
  * Execução das queries síncronas do SQLAlchemy via `run_in_threadpool`, alocando threads do pool apenas durante os milissegundos necessários para o `SELECT`.
* **Descarte de Cache L1 do ORM:** Uso de `db.expire_all()` a cada iteração para forçar o SQLAlchemy a buscar o estado fresco no PostgreSQL, sem reutilizar instâncias em memória.
* Resposta `200 OK` imediata na detecção do job terminal (`DONE` ou `FAILED`).
* Resposta `204 No Content` caso o tempo limite expire sem conclusão.

### Fase 9 — Testes Automatizados Abrangentes
* Configuração do ambiente de testes via `pytest`, `pytest-asyncio` e `httpx.AsyncClient`.
* Decisão de usar banco de dados real PostgreSQL (`vetglobal_test`), descartando SQLite para evitar falsos positivos de tipos e transações.
* Sobrescrita de configurações no `conftest.py` para testes rápidos (`POLL_TIMEOUT_SECONDS=2`).
* Criação da fixture `pet_tracker` com limpeza automática em cascata entre testes.
* Cobertura completa de 50 testes automatizados cobrindo:
  * Happy paths de todos os endpoints.
  * Validações de fronteira (boundary testing de 10 MB e inputs negativos).
  * Tratamento de erros (404, 409, 413, 415, 422).
  * Concorrência real via `asyncio.gather` (desbloqueio reativo do polling e serialização transacional do Lock Pessimista com `with_for_update`).

### Fase 10 — Infraestrutura Docker & Compose
* Construção de `Dockerfile` multi-stage para backend Python.
* Criação do `docker-compose.yml` orquestrando:
  * Serviço de banco de dados PostgreSQL 16 com healthcheck.
  * Script `init-db.sh` para provisionamento automático de bancos principal e de testes.
  * Serviço da API FastAPI com hot-reload.
  * Serviço de execução isolada de testes (`docker compose run --rm test`).
  * Serviço do Frontend SPA em React + Vite.

### Fase 11 — Documentação Técnica & Governança
* Elaboração do `README.md` principal estruturado para o fluxo do avaliador (Quick Start no topo).
* Eliminação de ruídos e emojis para comunicação puramente técnica.
* Formalização de decisões de arquitetura e trade-offs assumidos.

### Fase 12 — Validação Final & Diferencial Frontend
* Verificação completa da matriz de conformidade técnica.
* Desenvolvimento do Frontend SPA em React + TypeScript como item de proatividade, permitindo gerenciar pets, realizar uploads e simular workers visualmente em tempo real.

---

## Matriz de Rastreabilidade de Requisitos

| Requisito do Desafio | Componente de Implementação | Validação por Teste |
|----------------------|-----------------------------|---------------------|
| Cadastro de Pets | `POST /pets` (`pet_service.py`) | `test_create_pet_success`, validações 422 |
| Consulta de Pets | `GET /pets/{id}`, `GET /pets` | `test_get_pet_by_id_success`, `test_list_pets_pagination` |
| Upload de Documentos | `POST /pets/{id}/documents` (`document_service.py`) | `test_upload_txt_document_success`, `test_upload_pdf_document_success` |
| Formatos (.txt, .pdf) | Validação de extensão em service | `test_upload_unsupported_extensions` (415) |
| Limite de Tamanho (10 MB) | Validação de byte length | `test_upload_file_too_large` (413), `test_upload_file_exactly_at_size_limit` |
| Enfileiramento de Job | Criação atômica com status `ENQUEUED` | `test_pet_document_job_lifecycle` |
| Simulação de Worker | `POST /internal/jobs/{id}/complete` | `test_complete_job_done_success`, `test_complete_job_failed_success` |
| Idempotência de Conclusão | Verificação de estado terminal no `job_service.py` | `test_complete_job_idempotency_done`, `test_complete_job_conflict_done_to_failed` (409) |
| Consulta de Documento | `GET /documents/{id}` | `test_get_document_pending`, `test_get_document_ready`, `test_get_document_failed` |
| Long Polling (≤ 25s) | `GET /documents/{id}/poll` com `asyncio.sleep` | `test_poll_immediate_when_already_done`, `test_poll_concurrent_completion_done`, `test_poll_timeout_returns_204` |
| Semântica `after_job_id` | Filtro `job.id >= after_job_id` | `test_poll_respects_after_job_id_condition`, `test_poll_negative_after_job_id` |
| Containerização | `docker-compose.yml` | `docker compose up --build` funcional de ponta a ponta |
