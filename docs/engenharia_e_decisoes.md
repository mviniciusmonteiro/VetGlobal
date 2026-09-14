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
| **Aderência ao Cenário Clínico** | Ideal: arquivos até 10 MB | Risco de inconsistência | Complexidade operacional prematura |

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

### Lock Pessimista (`SELECT ... FOR UPDATE`)
Para prevenir race conditions caso callbacks concorrentes atinjam o endpoint simultaneamente para o mesmo identificador de job, a busca da entidade em `job_service.py` utiliza `select(Job).where(Job.id == job_id).with_for_update()`. 

Isso estabelece um bloqueio exclusivo na linha correspondente no PostgreSQL, garantindo que o primeiro worker conclua sua transação e os demais sejam avaliados de forma serializada pela lógica de idempotência (confirmando sucesso neutro `200 OK` se o status for idêntico ou rejeitando com `409 Conflict` se for divergente).

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

---

## 9. Deduplicação por Hash SHA-256 e Idempotência Transparente no Upload

### A Ambiguidade do Desafio
O documento de requisitos pontua explicitamente sob a seção de ambiguidades:  
> *"How should duplicate uploads be handled?"* — e cita como bônus: *"idempotency for upload or job completion"*.

Em sistemas clínicos assíncronos, o mesmo arquivo pode ser enviado múltiplas vezes por diversos fatores:
1. **Instabilidade de rede ou timeout:** o cliente envia o upload, a API processa e grava, mas a resposta HTTP é perdida na rota; o cliente/frontend então reenvia o arquivo automaticamente.
2. **Duplo clique do operador:** o veterinário clica repetidamente no botão de envio.
3. **Reenvio manual acidental:** envio posterior do mesmo arquivo de exame já cadastrado e sumarizado.

### A Arquitetura de Deduplicação Adotada

Para solucionar esse problema sem introduzir gargalos ou complexidade desnecessária, foi adotada a **Deduplicação por Hash SHA-256 com Idempotência Transparente**:

1. **Cálculo de Hash Criptográfico:**  
   Ao ler os bytes do arquivo em memória (`await file.read()`), o sistema calcula `hashlib.sha256(content).hexdigest()`. O hash resultante possui 64 caracteres hexadecimais com probabilidade negligenciável de colisão ($2^{-256}$).
2. **Indexação Composta em Banco de Dados:**  
   A coluna `file_hash` é persistida no modelo `Document` com um índice composto no PostgreSQL:
   ```python
   __table_args__ = (Index("ix_documents_pet_hash", "pet_id", "file_hash"),)
   ```
   Isso permite que a consulta de existência execute uma busca em árvore B ($O(1)$ em memória), sem varrer a tabela.
3. **Isolamento Estrito por Paciente (`pet_id`):**  
   A unicidade do hash é avaliada **estritamente dentro do contexto do pet**. Se dois pets distintos (ex: Pet A e Pet B) receberem um mesmo formulário ou exame padrão, ambos os registros são criados de forma totalmente isolada e independente, respeitando a privacidade dos prontuários.

### Matriz de Decisão de Estados

A verificação de duplicidade avalia o status do documento existente:

```
                  ┌───────────────► PENDING: Retorna 202 Accepted existente (is_duplicate=true)
Upload Recebido   │                          (Evita jobs concorrentes redundantes na fila)
      e           │
 Hash SHA-256 ────┼───────────────► READY:   Retorna 200 OK imediato (is_duplicate=true)
 Calculado        │                          (Entrega o resumo pronto sem esperar polling)
                  │
                  └───────────────► FAILED / Inexistente: Permite novo upload (is_duplicate=false)
                                             (Garante capacidade de retry caso o anterior tenha falhado)
```

| Status do Documento no Banco | Ação da API | Código HTTP | `is_duplicate` | Benefício de Engenharia |
|---|---|---|---|---|
| **`PENDING`** | Reutiliza `Document` e `Job` existentes | `202 Accepted` | `True` | Protege a fila de processamento contra jobs redundantes por clique duplo ou retries de rede. |
| **`READY`** | Reutiliza `Document` e `Job` existentes | `200 OK` | `True` | Economiza computação e tokens de LLM; entrega o resumo pronto na hora para o frontend sem necessidade de aguardar os 25s de Long Polling. |
| **`FAILED`** | **Ignora duplicado e cria novo** | `202 Accepted` | `False` | **Resiliência e Recuperabilidade:** Permite que o operador reenvie o arquivo para tentar novo processamento caso uma execução anterior tenha quebrado temporariamente. |

### Economia de Armazenamento e Recursos
Com essa estratégia, nenhum byte binário redundante é gravado na coluna `BYTEA` do PostgreSQL quando um documento repetido em estado `PENDING` ou `READY` é detectado. O sistema mantém consistência transacional absoluta e devolve uma resposta perfeitamente previsível e idempotente ao cliente.

### Evolução para Alta Concorrência: Índice Parcial Condicional
Em cenários de altíssima concorrência simultânea entre nós de API (onde dois uploads milissegundos idênticos poderiam tentar criar registros ao mesmo tempo antes do commit), a proteção em nível de banco de dados é modelada através de um **Índice Parcial Condicional**:

```sql
CREATE UNIQUE INDEX uq_pet_active_doc_hash 
ON documents (pet_id, file_hash) 
WHERE status IN ('PENDING', 'READY');
```

Uma restrição de unicidade incondicional comum (`UniqueConstraint("pet_id", "file_hash")`) quebraria o requisito de negócio que permite ao usuário reenviar um arquivo cujo processamento anterior falhou (`status = 'FAILED'`). O índice condicional do PostgreSQL resolve ambos os requisitos simultaneamente: blinda a unicidade de documentos ativos e preserva a capacidade legítima de retentativa.

