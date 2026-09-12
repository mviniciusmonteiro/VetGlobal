# Engenharia, Arquitetura e Decisões Técnicas — VetGlobal

Este documento detalha as decisões de arquitetura de baixo nível, os desafios de concorrência e as soluções de engenharia adotadas no desenvolvimento do **VetGlobal Backend**.

---

## 1. Concorrência e Long Polling: Prevenção de Threadpool Starvation

### O Problema do Threadpool Starvation
No FastAPI/Starlette, rotas declaradas como síncronas (`def`) são executadas em um pool de threads gerenciado pelo AnyIO. O tamanho padrão desse pool é de aproximadamente 40 threads.

Se o endpoint de polling fosse implementado como síncrono com bloqueio tradicional:

```python
# Anti-pattern crítico:
def poll_document(...):
    while time.time() < deadline:
        time.sleep(0.5)  # Trava uma thread do sistema operacional por até 25s
```

Com apenas 40 clientes simultâneos aguardando o processamento de seus prontuários, **todas as threads do pool seriam exauridas**. Nesse momento, qualquer requisição subsequente — mesmo uma rota leve como `GET /health` ou `POST /pets` — ficaria enfileirada, congelando completamente o backend.

### A Solução Híbrida: `async def` + `run_in_threadpool`
Para resolver essa limitação sem a necessidade de reescrever toda a camada de banco de dados para drivers assíncronos (`asyncpg`), foi adotada uma estratégia cirúrgica:

1. A rota é declarada como assíncrona: `async def poll_document(...)`.
2. A espera de 0.5s entre verificações é delegada diretamente ao Event Loop: `await asyncio.sleep(0.5)`. Isso suspende a corrotina sem reter nenhuma thread do sistema operacional.
3. As operações síncronas do SQLAlchemy são despachadas via `run_in_threadpool`, pegando uma thread do pool apenas pelos milissegundos estritamente necessários para emitir o `SELECT`:

```python
# Solução de alta concorrência:
while time.monotonic() < deadline:
    job = await run_in_threadpool(get_latest_job_sync, db, document_id)
    if job and job.id >= after_job_id and job.status in ("DONE", "FAILED"):
        return build_response(document, job)
    
    # Libera a thread imediatamente; a espera ocorre no Event Loop:
    await asyncio.sleep(POLL_INTERVAL_SECONDS)
```

Essa arquitetura permite que uma única instância atenda centenas de conexões de polling concorrentes com consumo desprezível de CPU e memória.

---

## 2. Cache L1 de Sessão do SQLAlchemy: O Papel Vital de `db.expire_all()`

### O Desafio do Identity Map
O SQLAlchemy implementa o padrão *Identity Map*, que atua como um cache em memória de primeiro nível (L1) no ciclo de vida de uma sessão (`Session`). Quando um objeto é consultado, o SQLAlchemy o mantém indexado pela sua chave primária.

Em uma rota tradicional de requisição/resposta curta, esse comportamento é transparente. Contudo, em um loop de Long Polling onde a mesma sessão permanece aberta por até 25 segundos, o Identity Map gera um efeito colateral crítico:

1. O cliente inicia o poll: a sessão consulta o documento e o job com status `ENQUEUED`.
2. Um processo externo (worker) executa `POST /internal/jobs/{id}/complete` em outra transação e commita o status `DONE`.
3. Na iteração seguinte do loop, se a sessão emitir uma nova consulta sem expirar o cache, o SQLAlchemy **reutiliza a instância em memória previamente carregada**, ignorando a alteração commitada no PostgreSQL. O cliente sofreria timeout mesmo com o job já finalizado no banco.

### A Solução
A cada ciclo do loop de verificação, é executado explicitamente:

```python
db.expire_all()
```

O comando `expire_all()` invalida todos os atributos carregados na sessão, forçando o SQLAlchemy a recarregar o estado real das entidades diretamente do PostgreSQL na query seguinte.

---

## 3. Persistência de Arquivos: PostgreSQL BYTEA vs. Object Storage

### Decisão: Armazenamento em Coluna `BYTEA` (Limite de 10 MB)

| Critério | PostgreSQL `BYTEA` | File System Local | Object Storage (S3 / GCS) |
|----------|-------------------|-------------------|---------------------------|
| **Statelessness** | Total: compartilhado nativamente entre instâncias | Quebrado: exige volumes de rede compartilhados (NFS/EFS) | Total: storage centralizado desacoplado |
| **Consistência ACID** | Total: arquivo, metadados e job gravados no mesmo commit | Inexistente: risco de arquivos órfãos se a rota falhar | Eventual: exige orquestração de rollback manual |
| **Complexidade Operacional** | Zero: provisionado automaticamente pelo Docker Compose | Média: gerenciamento de permissões de diretório no container | Alta: exige credenciais IAM, buckets, mocks locais |
| **Escopo do Desafio** | Ideal: arquivos até 10 MB | Não recomendado | Over-engineering para o contexto |

### Defesa Arquitetural
Para documentos clínicos de texto e PDFs de até 10 MB, armazenar o conteúdo binário como `BYTEA` garante transações atômicas com integridade garantida pelo motor do PostgreSQL. Se a criação do `Job` falhar, o `db.rollback()` desfaz também a gravação do arquivo, evitando resíduos no armazenamento.

**Trade-off para Produção:** Em sistemas de hiperescala com arquivos volumosos (ex: exames de imagem DICOM de centenas de megabytes), a migração natural seria para S3 com URLs pré-assinadas (*presigned URLs*), onde a API atua apenas como coordenadora de metadados sem transitar grandes payloads binários em sua própria memória.

---

## 4. Resiliência do Pool de Conexões (Connection Pooling)

A criação da engine SQLAlchemy em `app/db/session.py` incorpora proteções contra falhas comuns em ambientes conteinerizados:

```python
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)
```

* **`pool_pre_ping=True`:** Em arquiteturas de containers ou conexões sob proxies de rede, conexões TCP inativas podem ser encerradas silenciosamente pelo firewall ou pelo PostgreSQL após períodos ociosos. Sem o *pre-ping*, a aplicação tentaria reutilizar um socket quebrado, gerando erros `500 OperationalError: server closed the connection unexpectedly`. O *pre-ping* emite um comando leve (`SELECT 1`) antes de entregar a conexão à rota; caso a conexão esteja morta, ela é descartada e renovada de forma transparente.
* **`autocommit=False` e `autoflush=False`:** Asseguram que nenhuma modificação seja gravada sem invocação explícita de `db.commit()`, mantendo o isolamento transacional estrito.

---

## 5. Integridade Relacional e Deleção em Cascata

A modelagem relacional define constraints diretas no schema do banco de dados:

```
Pet ──(1:N)──> Document ──(1:N)──> Job
```

* **`ondelete="CASCADE"` nas Foreign Keys:** Ao deletar um pet, o motor do PostgreSQL se encarrega de expurgar todos os documentos e jobs filhos associados. Isso elimina o risco de dados zumbis e desonera a camada de aplicação de executar deleções manuais encadeadas.
* **Enums Nativos no PostgreSQL:** Os status de `JobStatus`, `DocumentStatus` e `PetGender` são mapeados como enums nativos no PostgreSQL, impedindo inserções com valores arbitrários diretamente na camada de persistência.

---

## 6. Máquina de Estados e Idempotência no Worker

O endpoint `POST /internal/jobs/{job_id}/complete` implementa regras rígidas de transição de estado:

```
                  ┌─────────► DONE (Terminal)
ENQUEUED /        │             │
PROCESSING ───────┤             └── [Retry com DONE: 200 OK (Idempotente)]
                  │             └── [Tentativa de FAILED: 409 Conflict]
                  │
                  └─────────► FAILED (Terminal)
                                │
                                └── [Retry com FAILED: 200 OK (Idempotente)]
                                └── [Tentativa de DONE: 409 Conflict]
```

### Princípio do First-Write-Wins
Se um worker concluir o processamento com sucesso mas perder a conexão antes de receber o retorno HTTP da API, ele reenviará a requisição. A API detecta que o job já atingiu o estado `DONE` com o mesmo resultado e responde `200 OK` imediatamente, sem emitir escritas redundantes nem corromper dados.

Caso receba uma instrução conflitante para um estado já consolidado (ex: um job `DONE` tentando ser alterado para `FAILED`), a API rejeita categoricamente a operação com `409 Conflict`.

---

## 7. Observabilidade e Telemetria Integrada

O modelo `Job` registra os timestamps de criação (`created_at`) e finalização (`completed_at`) em fuso horário UTC (`DateTime(timezone=True)`):

```python
duration_ms = int((job.completed_at - job.created_at).total_seconds() * 1000)
```

No response de consulta (`GET /documents/{id}`), esses dados são expostos diretamente:
* `completed_at`: data e hora UTC da conclusão.
* `duration_ms`: latência total de processamento em milissegundos.

Isso fornece telemetria nativa para monitoramento de SLA e detecção precoce de degradação de performance dos workers sem dependência inicial de ferramentas externas de APM.

---

## 8. Estratégia de Testes Automatizados

### Por que PostgreSQL Real e não SQLite em Memória?
Muitas aplicações utilizam SQLite para execução de testes por comodidade. No entanto, o SQLite apresenta divergências profundas em relação ao PostgreSQL:
* Comportamento de locking e concorrência transacional.
* Tratamento de campos binários (`BYTEA`) e serialização de Enums nativos.
* Semântica de datas com timezone.

A suíte de testes do VetGlobal roda 100% contra uma base PostgreSQL real (`vetglobal_test`), garantindo que o comportamento observado nos testes seja idêntico ao de produção.

### Testes de Concorrência com `asyncio.gather`
Para validar a resiliência do Long Polling, foram construídos testes assíncronos que abrem a requisição de poll e, de forma concorrente em background, disparam a conclusão do job via worker, assegurando que o poll desbloqueia e retorna o resultado sem travas ou timeouts indesejados.
