# ==============================================================================
# VetGlobal Frontend — Dockerfile
# Imagem baseada em node:20-alpine para desenvolvimento e execução do SPA
# ==============================================================================

FROM node:20-alpine

WORKDIR /app

# Copiar manifesto de dependências aproveitando cache de camadas do Docker
COPY package*.json ./

# Instalação das dependências
RUN npm install

# Copiar código-fonte da aplicação
COPY . .

# Porta padrão de exposição do Vite
EXPOSE 5173

# Inicialização do Vite escutando em todas as interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
