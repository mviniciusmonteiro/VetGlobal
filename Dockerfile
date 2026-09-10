# ==============================================================================
# VetGlobal Backend — Dockerfile
# Imagem enxuta baseada em python:3.11-slim para ambientes de desenvolvimento e produção
# ==============================================================================

FROM python:3.11-slim

# Evita geração de bytecode .pyc e garante logs em tempo real no stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on

WORKDIR /app

# Instalar dependências do sistema necessárias se houver compilação
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependências Python aproveitando cache de camadas do Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo o código-fonte da aplicação
COPY . .

# Garantir existência do diretório de uploads
RUN mkdir -p uploads

# Porta padrão de exposição da API FastAPI
EXPOSE 8000

# Inicialização do servidor Uvicorn escutando em todas as interfaces
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
