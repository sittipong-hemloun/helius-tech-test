-- Performance tuning chosen from the baseline EXPLAIN ANALYZE (docs/performance.md, PRD §15.3).
-- Expand-only: adding indexes keeps the previous image compatible during a rollback.

-- Name "contains" search runs `lower(name) LIKE '%…%'`; a B-tree cannot serve a leading wildcard,
-- so use a trigram GIN index on the same expression (needs ≥3 characters; shorter terms seq-scan with LIMIT).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "employees_name_trgm_idx" ON "employees" USING gin (lower("name") gin_trgm_ops);

-- Department + Status filter and its count (also serves the FK lookup on department_id).
CREATE INDEX "employees_department_id_is_active_idx" ON "employees" ("department_id", "is_active");
