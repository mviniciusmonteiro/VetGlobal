# VetGlobal — Frontend Web

Interface de usuário (SPA) para gerenciamento de pacientes veterinários, upload de prontuários clínicos, acompanhamento assíncrono via Long Polling e simulação de tarefas de worker.

---

## Tecnologias

* **React 19**
* **TypeScript**
* **Vite** (Dev Server e Bundler)
* **TailwindCSS v4** (Estilização moderna e responsiva)
* **Lucide React** (Ícones da interface)

---

## Funcionalidades

* **Diretório de Pacientes:** Cadastro e seleção dinâmica de pets.
* **Upload de Prontuários:** Envio de arquivos nos formatos `.pdf` e `.txt` (com validações de formato e limite de 10 MB).
* **Acompanhamento em Tempo Real (Long Polling):** Monitoramento assíncrono da fila de processamento até a emissão do laudo, com contagem de ciclos e status em tempo real.
* **Simulador de Worker Integrado:** Ferramenta interativa para simular o processamento em segundo plano, permitindo concluir (`DONE` com laudo diagnóstico gerado) ou falhar (`FAILED` com mensagem de erro).
* **Visualização de Laudos:** Apresentação clara do sumário diagnóstico gerado pelo processamento.

---

## Pré-requisitos

* **Node.js** (v18 ou superior recomendado)
* **npm** (ou yarn / pnpm)
* **Backend VetGlobal** em execução (padrão em `http://localhost:8000`)

---

## Como Executar Localmente

### 1. Entrar na pasta e instalar dependências

A partir da raiz do repositório:

```bash
cd frontend
npm install
```

### 2. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em: **[http://localhost:5173](http://localhost:5173)**

---

## ⚙️ Configuração (Variáveis de Ambiente)

Por padrão, a aplicação conecta na API em `http://localhost:8000`. 

Caso queira apontar para outro host ou porta, crie um arquivo `.env` na pasta `frontend/`:

```env
VITE_API_URL=http://localhost:8000
```

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite (`http://localhost:5173`) com Hot Module Replacement (HMR) |
| `npm run build` | Compila o TypeScript e gera o bundle otimizado de produção na pasta `dist/` |
| `npm run preview` | Executa um servidor web local para testar a versão gerada pelo build |
| `npm run lint` | Executa o linter de código (Oxlint) |
