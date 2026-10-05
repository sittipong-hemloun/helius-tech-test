#!/bin/bash
# Creates separate roles/databases for the app, and the test runners (PRD §13.1).
# Runs once on an empty data volume (docker-entrypoint-initdb.d) and again on every `pnpm dev:up`
# / staging deploy, so it is idempotent: existing volumes are brought to the same role layout.
#   app role  — owns the app databases, cannot create databases (least privilege for dev/staging)
#   test role — CREATEDB, owns only the throwaway employee_console_test_* databases
set -euo pipefail

: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"
APP_DATABASES="${APP_DATABASES:-employee_console_dev}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN NOCREATEDB PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER ROLE %I NOCREATEDB', :'app_user') \gexec
SQL

for db in ${APP_DATABASES//,/ }; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -v db="$db" -v owner="$APP_DB_USER" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'owner')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SQL
done

if [[ -n "${TEST_DB_USER:-}" && -n "${TEST_DB_PASSWORD:-}" ]]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v test_user="$TEST_DB_USER" -v test_password="$TEST_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN CREATEDB PASSWORD %L', :'test_user', :'test_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'test_user') \gexec
SELECT format('ALTER ROLE %I LOGIN CREATEDB PASSWORD %L', :'test_user', :'test_password') \gexec
-- Throwaway databases left by older runs (created by the app role) move to the test role so it can drop them.
SELECT format('ALTER DATABASE %I OWNER TO %I', datname, :'test_user')
FROM pg_database WHERE datname ~ '^employee_console_test' \gexec
SQL
fi

