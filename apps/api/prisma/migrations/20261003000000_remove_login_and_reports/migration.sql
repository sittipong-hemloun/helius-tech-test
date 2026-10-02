-- Scope cut: no login (the console is open to every visitor with full access) and no AI reports
-- (n8n worker + Gemini). Per-user state, the report queue and the worker heartbeat go away.
-- Contract migration: an image older than this one expects these tables, so a staging rollback
-- across it needs a database restore (docs/runbook.md).

-- Idempotency keys are ephemeral (24 h); clearing them avoids duplicate (scope, key) pairs
-- once the actor is no longer part of the key.
DELETE FROM "idempotency_keys";

-- Dropping the column also drops its foreign key and the (scope, actor_id, key) unique index.
ALTER TABLE "idempotency_keys" DROP COLUMN "actor_id";
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");

-- reports references users, so it goes first.
DROP TABLE "reports";
DROP TABLE "integration_state";
DROP TABLE "sessions";
DROP TABLE "users";

DROP TYPE "Role";
DROP TYPE "ReportStatus";
DROP TYPE "ReportSource";
DROP TYPE "ReportGenerator";
