# Guia de Execução via cURL — VetGlobal Backend

Este guia fornece um fluxo completo de testes ponta a ponta utilizando o utilitário de linha de comando `curl`. Os comandos podem ser executados em qualquer terminal (Linux, macOS, WSL ou PowerShell no Windows).

Certifique-se de que a aplicação esteja rodando na porta padrão (`http://localhost:8000`).

---

## 1. Verificação de Saúde da API

```bash
curl -X GET http://localhost:8000/health
```

**Resposta esperada (HTTP 200):**
```json
{
  "status": "ok"
}
```

---

## 2. Cadastro de um Novo Pet

```bash
curl -X POST http://localhost:8000/pets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hank",
    "owner_name": "John Bergeson"
  }'
```

**Resposta esperada (HTTP 201):**
```json
{
  "id": 1,
  "name": "Hank",
  "owner_name": "John Bergeson"
}
```

---

## 3. Listagem de Pets com Paginação

```bash
curl -X GET "http://localhost:8000/pets?skip=0&limit=10"
```

**Resposta esperada (HTTP 200):**
```json
[
  {
    "id": 1,
    "name": "Hank",
    "owner_name": "John Bergeson"
  }
]
```

---

## 4. Upload de Prontuário Clínico

Crie um arquivo de teste rápido caso não possua um:

```bash
echo "Paciente canino Hank apresentou quadro estavel apos hidratacao." > prontuario_hank.txt
```

Envie o documento associando-o ao pet criado (`pet_id = 1`):

```bash
curl -X POST http://localhost:8000/pets/1/documents \
  -F "file=@prontuario_hank.txt"
```

**Resposta esperada (HTTP 202):**
```json
{
  "document_id": 1,
  "job_id": 1,
  "status": "ENQUEUED"
}
```

---

## 5. Início do Long Polling

Inicie o polling informando o `job_id` recebido no upload (`after_job_id = 1`). A requisição permanecerá aberta aguardando a conclusão:

```bash
curl -X GET "http://localhost:8000/documents/1/poll?after_job_id=1"
```

*(Enquanto o comando acima estiver aguardando no terminal, abra um segundo terminal para executar o passo 6 a seguir).*

---

## 6. Conclusão do Job pelo Worker (Simulação)

Em outro terminal, simule o callback de finalização com sucesso pelo worker de processamento:

```bash
curl -X POST http://localhost:8000/internal/jobs/1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE",
    "summary": "Prontuario processado com sucesso. Paciente canino em recuperacao sem complicacoes aparentes."
  }'
```

**Resposta no terminal do worker (HTTP 200):**
```json
{
  "id": 1,
  "status": "DONE",
  "error": null,
  "completed_at": "2026-09-11T22:45:00Z"
}
```

**Retorno imediato no terminal do Long Polling (HTTP 200):**
```json
{
  "id": 1,
  "status": "READY",
  "summary": "Prontuario processado com sucesso. Paciente canino em recuperacao sem complicacoes aparentes.",
  "error": null,
  "completed_at": "2026-09-11T22:45:00Z",
  "duration_ms": 3420
}
```

---

## 7. Consulta Posterior do Documento Processado

```bash
curl -X GET http://localhost:8000/documents/1
```

**Resposta esperada (HTTP 200):**
```json
{
  "id": 1,
  "status": "READY",
  "summary": "Prontuario processado com sucesso. Paciente canino em recuperacao sem complicacoes aparentes.",
  "error": null,
  "completed_at": "2026-09-11T22:45:00Z",
  "duration_ms": 3420
}
```

---

## 8. Testes de Idempotência e Validações de Erro

### Teste de Idempotência (Reenvio pelo Worker)
Reenvie o mesmo payload para o job já concluído:

```bash
curl -X POST http://localhost:8000/internal/jobs/1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE",
    "summary": "Mesmo resumo reenviado por retentativa de rede."
  }'
```

**Resultado:** Retorna `200 OK` como operação neutra (no-op), sem alterar os dados originais.

### Teste de Conflito de Estado
Tente transicionar o job já `DONE` para `FAILED`:

```bash
curl -X POST http://localhost:8000/internal/jobs/1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "status": "FAILED",
    "error": "Erro forçado em estado já finalizado"
  }'
```

**Resultado:** Rejeitado com `HTTP 409 Conflict`.

### Teste de Formato Inválido no Upload
Tente enviar um arquivo não suportado (ex: `.png`, `.exe`, `.csv`):

```bash
echo "dados" > teste.csv
curl -X POST http://localhost:8000/pets/1/documents -F "file=@teste.csv"
```

**Resultado:** Rejeitado com `HTTP 415 Unsupported Media Type`.
