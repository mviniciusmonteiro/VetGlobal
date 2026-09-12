# Plano de Testes — VetGlobal Backend

Este documento estabelece a estratégia formal de testes, a arquitetura do ambiente de testes, a matriz de cobertura dos 44 testes automatizados e os critérios de qualidade adotados no projeto **VetGlobal**.

---

## 1. Objetivos do Plano de Testes

* **Garantir a Correção Funcional:** Validar que todos os 5 fluxos principais da API (Health, Pets, Upload de Documentos, Jobs Assíncronos e Long Polling) atendem estritamente aos requisitos do enunciado.
* **Prevenir Regressões e Efeitos Colaterais:** Assegurar que alterações na camada de persistência ou nos contratos HTTP não quebrem fluxos existentes.
* **Validar Concorrência e Condições de Corrida:** Demonstrar que o mecanismo de Long Polling é reativo e desbloqueia corretamente sob requisições paralelas sem bloquear o Event Loop ou o pool de threads.
* **Garantir Previsibilidade no Tratamento de Erros:** Certificar que nenhuma falha de validação ou exceção de domínio resulte em `500 Internal Server Error`, retornando os status codes HTTP semânticos (404, 409, 413, 415, 422).
* **Validar Idempotência:** Garantir a resiliência contra retentativas de rede de workers externos (*first-write-wins*).

---

## 2. Arquitetura e Estratégia do Ambiente de Testes

### 2.1. Banco de Dados Real (PostgreSQL) vs. SQLite
A suíte de testes executa **100% contra uma instância real do PostgreSQL** (banco dedicado `vetglobal_test`), descartando o uso de SQLite em memória.

| Critério | SQLite em Memória | PostgreSQL Real (`vetglobal_test`) |
|----------|-------------------|-----------------------------------|
| **Fidelidade de Tipos** | Limitada (não suporta Enums nativos nem tipos complexos) | Idêntica à produção (Enums nativos, `BYTEA`, timezone UTC) |
| **Comportamento Transacional** | Locking a nível de tabela (não reflete concorrência real) | MVCC (Multi-Version Concurrency Control) idêntico à produção |
| **Constraints & Cascade** | Suporte a Foreign Keys desligado por padrão | Integridade relacional e `ondelete="CASCADE"` plenamente validados |
| **Risco de Falsos Positivos** | Alto (código passa nos testes e falha na homologação) | Nulo (o mesmo motor e driver que rodam em produção) |

### 2.2. Isolamento e Limpeza Automática (`pet_tracker`)
Para garantir independência total entre os testes (sem ordem de dependência e sem vazamento de estado):
* Foi desenvolvida a fixture `pet_tracker` no `tests/conftest.py`.
* Cada teste registra os IDs das entidades criadas.
* No *teardown* (finalização do teste), a fixture executa deleção em cascata diretamente no banco (`Pet → Document → Job`), assegurando que a base permaneça limpa para o próximo teste.

### 2.3. Otimização de Tempo de Execução (Fast Polling)
O timeout padrão de 25 segundos do Long Polling tornaria a suíte inviável para integração contínua (demoraria minutos).
* A fixture de ambiente no `tests/conftest.py` sobrescreve as variáveis:
  * `POLL_TIMEOUT_SECONDS = 2` (em vez de 25s)
  * `POLL_INTERVAL_SECONDS = 0.1` (em vez de 0.5s)
* **Resultado:** Os 44 testes automatizados rodam em **menos de 10 segundos**, mantendo a mesma semântica do código em produção.

---

## 3. Níveis e Técnicas de Teste Aplicadas

```
┌────────────────────────────────────────────────────────┐
│  Testes de Concorrência Assíncrona                    │
│  (httpx.AsyncClient + asyncio.gather)                 │
├────────────────────────────────────────────────────────┤
│  Testes de Integração de API (HTTP Endpoints)         │
│  (FastAPI TestClient: 200, 201, 202, 204, 4xx)        │
├────────────────────────────────────────────────────────┤
│  Testes de Persistência & Integridade Relacional       │
│  (SQLAlchemy Session, Foreign Keys, Cascade Delete)    │
├────────────────────────────────────────────────────────┤
│  Testes Unitários de Schemas e Validação de Entrada   │
│  (Pydantic v2: strip de strings, limites de tamanho)   │
└────────────────────────────────────────────────────────┘
```

* **Happy Path Testing:** Validação do fluxo nominal bem-sucedido de ponta a ponta.
* **Negative & Boundary Testing:** Testes com payloads ausentes, vazios, formatos inválidos e arquivo exatamente no limite de 10 MB (10.485.760 bytes).
* **State Machine & Idempotency Testing:** Validação das transições de estado permitidas e rejeição de transições inválidas com HTTP 409.
* **Race Condition Testing:** Disparo simultâneo de requisição de espera e conclusão de worker para testar o desbloqueio sob concorrência real.

---

## 4. Matriz Detalhada de Casos de Teste (44 Testes)

### 4.1. Camada de Banco de Dados (`tests/test_database.py` — 2 testes)

| ID | Nome do Teste | Cenário Avaliado | Resultado Esperado |
|----|---------------|------------------|--------------------|
| DB-01 | `test_database_connection` | Conexão física com PostgreSQL de testes | Sessão abre e executa `SELECT 1` com sucesso |
| DB-02 | `test_pet_document_job_lifecycle` | Criação relacional `Pet → Document → Job` e exclusão | Exclusão do Pet limpa Documentos e Jobs via cascade delete |

### 4.2. Recurso de Pets (`tests/test_pets.py` — 9 testes)

| ID | Nome do Teste | Cenário Avaliado | Resultado Esperado |
|----|---------------|------------------|--------------------|
| PET-01 | `test_create_pet_success` | Cadastro com dados válidos | HTTP 201 Created + ID persistido |
| PET-02 | `test_create_pet_strips_whitespace` | Envio de strings com espaços extras | HTTP 201 + strings sanitizadas |
| PET-03 | `test_create_pet_missing_name` | Campo `name` ausente no payload | HTTP 422 Unprocessable Entity |
| PET-04 | `test_create_pet_missing_owner_name` | Campo `owner_name` ausente | HTTP 422 Unprocessable Entity |
| PET-05 | `test_create_pet_empty_strings` | Strings vazias ou contendo apenas espaços | HTTP 422 Unprocessable Entity |
| PET-06 | `test_get_pet_by_id_success` | Consulta de pet existente por ID | HTTP 200 OK + dados do pet |
| PET-07 | `test_get_pet_by_id_not_found` | Consulta de ID inexistente | HTTP 404 Not Found |
| PET-08 | `test_list_pets` | Listagem geral de pets | HTTP 200 OK + lista de pets |
| PET-09 | `test_list_pets_pagination` | Paginação com parâmetros `skip` e `limit` | HTTP 200 OK com recorte exato |
| PET-10 | `test_get_pet_with_uploaded_documents` | Pet com múltiplos documentos vinculados | HTTP 200 OK mantendo integridade |

### 4.3. Upload e Gestão de Documentos (`tests/test_documents.py` — 21 testes)

| ID | Nome do Teste | Cenário Avaliado | Resultado Esperado |
|----|---------------|------------------|--------------------|
| DOC-01 | `test_upload_txt_document_success` | Upload de arquivo `.txt` válido | HTTP 202 Accepted + `job_id` |
| DOC-02 | `test_upload_pdf_document_success` | Upload de arquivo `.pdf` válido | HTTP 202 Accepted + `job_id` |
| DOC-03 | `test_upload_unsupported_extensions` | Upload de arquivos `.csv`, `.png`, `.exe` | HTTP 415 Unsupported Media Type |
| DOC-04 | `test_upload_pet_not_found` | Upload associado a `pet_id` inexistente | HTTP 404 Not Found |
| DOC-05 | `test_upload_file_too_large` | Arquivo excedendo 10 MB | HTTP 413 Payload Too Large |
| DOC-06 | `test_upload_file_exactly_at_size_limit` | Arquivo exatamente no limite (10 MB exatos) | HTTP 202 Accepted (Boundary validado) |
| DOC-07 | `test_upload_empty_file` | Arquivo com 0 bytes | HTTP 422 Unprocessable Entity |
| DOC-08 | `test_upload_without_file_field` | Requisição multipart sem o campo `file` | HTTP 422 Unprocessable Entity |
| DOC-09 | `test_upload_multiple_documents_same_pet` | Múltiplos uploads sucessivos para mesmo pet | HTTP 202 em todos; jobs independentes |
| DOC-10 | `test_get_document_pending` | Consulta de documento recém-criado | HTTP 200 OK + status `PENDING` |
| DOC-11 | `test_get_document_ready` | Consulta de documento com job concluído | HTTP 200 OK + status `READY` + `summary` |
| DOC-12 | `test_get_document_failed` | Consulta de documento com job falhado | HTTP 200 OK + status `FAILED` + `error` |
| DOC-13 | `test_get_document_not_found` | Consulta de documento inexistente | HTTP 404 Not Found |
| DOC-14 | `test_get_document_full_workflow` | Fluxo completo (Pet → Upload → Worker → Get) | HTTP 200 OK com `completed_at` e `duration_ms` |
| DOC-15 | `test_poll_immediate_when_already_done` | Poll em documento que já finalizou antes da chamada | HTTP 200 OK imediato (sem esperar timeout) |
| DOC-16 | `test_poll_concurrent_completion_done` | Poll aguardando enquanto worker finaliza `DONE` | HTTP 200 OK desbloqueado via concorrência |
| DOC-17 | `test_poll_concurrent_completion_failed` | Poll aguardando enquanto worker finaliza `FAILED` | HTTP 200 OK desbloqueado contendo `error` |
| DOC-18 | `test_poll_timeout_returns_204` | Poll sem alteração durante janela de timeout | HTTP 204 No Content |
| DOC-19 | `test_poll_respects_after_job_id_condition` | Poll com `after_job_id` superior aos jobs concluídos | Permanece aguardando até atingir 204 |
| DOC-20 | `test_poll_negative_after_job_id` | Envio de `after_job_id < 0` | HTTP 422 Unprocessable Entity |
| DOC-21 | `test_poll_document_not_found` | Poll em documento inexistente | HTTP 404 Not Found imediato (sem loop) |

### 4.4. Jobs e Simulação do Worker (`tests/test_jobs.py` — 10 testes)

| ID | Nome do Teste | Cenário Avaliado | Resultado Esperado |
|----|---------------|------------------|--------------------|
| JOB-01 | `test_complete_job_done_success` | Conclusão normal com status `DONE` | HTTP 200 OK; Job `DONE`, Document `READY` |
| JOB-02 | `test_complete_job_failed_success` | Conclusão normal com status `FAILED` | HTTP 200 OK; Job `FAILED`, Document `FAILED` |
| JOB-03 | `test_complete_job_not_found` | Conclusão para `job_id` inexistente | HTTP 404 Not Found |
| JOB-04 | `test_complete_job_idempotency_done` | Worker retransmite status `DONE` para job já `DONE` | HTTP 200 OK (no-op idempotente, first-write-wins) |
| JOB-05 | `test_complete_job_idempotency_failed` | Worker retransmite `FAILED` para job já `FAILED` | HTTP 200 OK (no-op idempotente) |
| JOB-06 | `test_complete_job_conflict_done_to_failed` | Tentativa de mudar de `DONE` para `FAILED` | HTTP 409 Conflict |
| JOB-07 | `test_complete_job_conflict_failed_to_done` | Tentativa de mudar de `FAILED` para `DONE` | HTTP 409 Conflict |
| JOB-08 | `test_complete_job_invalid_status` | Status desconhecido enviado no payload | HTTP 422 Unprocessable Entity |
| JOB-09 | `test_complete_job_done_without_summary` | Conclusão `DONE` sem envio de campo `summary` | HTTP 200 OK (campo opcional no contrato) |
| JOB-10 | `test_complete_job_failed_without_error` | Conclusão `FAILED` sem envio de campo `error` | HTTP 200 OK (campo opcional no contrato) |

### 4.5. Monitoramento (`tests/test_health.py` — 1 teste)

| ID | Nome do Teste | Cenário Avaliado | Resultado Esperado |
|----|---------------|------------------|--------------------|
| HLT-01 | `test_health_check` | Chamada ao endpoint `GET /health` | HTTP 200 OK + `{"status": "ok"}` |

---

## 5. Critérios de Aceite e Métricas de Qualidade

Para considerar a suíte de testes aprovada para entrega de produção:

1. **Taxa de Sucesso:** 100% dos testes aprovados (`44 passed, 0 failed, 0 errors`).
2. **Tempo Total de Execução:** Menor que 15 segundos em ambiente local e conteinerizado.
3. **Ausência de Erros 500:** Nenhum caso de teste negativo (dados corrompidos, tipos inválidos, arquivos gigantes) pode disparar exceção não tratada.
4. **Isolamento de Dados:** Ao término da execução, a contagem de registros no banco de testes deve ser idêntica à contagem inicial (zero resíduos).

---

## 6. Instruções de Execução

### Execução Local

```bash
# Execução padrão detalhada:
pytest -v

# Execução compacta:
pytest -q

# Execução filtrada por módulo (ex: apenas testes de polling):
pytest -v -k "poll"

# Verificação de tempo individual por teste:
pytest -v --durations=5
```

### Execução Isolada via Docker Compose

```bash
docker compose run --rm test
```
