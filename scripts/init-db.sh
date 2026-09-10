#!/bin/bash
set -e

# Cria os bancos de dados de desenvolvimento e de testes automaticamente na inicialização do PostgreSQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE vetglobal'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vetglobal')\gexec

    SELECT 'CREATE DATABASE vetglobal_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vetglobal_test')\gexec
EOSQL
