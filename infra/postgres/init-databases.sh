#!/bin/bash
# Runs once on an empty data volume (docker-entrypoint-initdb.d).
# Creates separate roles/databases for the app and n8n (PRD §13.1).
set -euo pipefail

: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
APP_DATABASES="${APP_DATABASES:-employee_console_dev}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN CREATEDB PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
SQL

for db in ${APP_DATABASES//,/ }; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -v db="$db" -v owner="$APP_DB_USER" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'owner')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SQL
done

if [[ -n "${N8N_DB_PASSWORD:-}" ]]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -v pw="$N8N_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE n8n LOGIN PASSWORD %L', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n') \gexec
SELECT 'CREATE DATABASE n8n OWNER n8n'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'n8n') \gexec
SQL
fi
