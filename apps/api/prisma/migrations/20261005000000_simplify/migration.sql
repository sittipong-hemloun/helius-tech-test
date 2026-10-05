-- Scope cut D-56: no Idempotency-Key on create and no database purpose marker.
-- Optimistic locking (employees.version + If-Match) stays.
DROP TABLE "idempotency_keys";
DROP TABLE "app_meta";
