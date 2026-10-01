import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ApiException, Errors } from '../common/api-exception.js';
import { Clock } from '../common/clock.js';
import { JsonLogger } from '../common/json-logger.js';
import { businessDate } from '../common/dates.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { isUniqueViolation, pgErrorCode } from '../database/db-errors.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { canonicalJson, hashPayload } from '../idempotency/idempotency.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { randomToken } from '../auth/session-helpers.js';
import { isRetryable, narrativeRule, nextRetryDelayMs, SYSTEM_ERROR_CODES, type Narrative } from './report-rules.js';
import { captureSnapshot, type Snapshot } from './snapshot.js';

export type ReportStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

interface ReportRow {
  id: string;
  status: ReportStatus;
  source: 'MANUAL' | 'SCHEDULED';
  snapshot: Snapshot;
  narrative: Narrative | null;
  created_at: Date;
  completed_at: Date | null;
  deadline_at: Date;
  attempts: number;
  next_attempt_at: Date;
  lease_token_hash: string | null;
  lease_expires_at: Date | null;
  generated_by: 'GEMINI' | 'TEMPLATE' | null;
  model: string;
  prompt_version: string;
  error_code: string | null;
  result_hash: string | null;
}

export interface ReportSummary {
  id: string;
  status: ReportStatus;
  source: 'MANUAL' | 'SCHEDULED';
  snapshotCapturedAt: string;
  totalEmployees: number;
  createdAt: string;
  completedAt: string | null;
  generatedBy: 'GEMINI' | 'TEMPLATE' | null;
  model: string | null;
  promptVersion: string;
  errorCode: string | null;
}

export interface ReportDetail extends ReportSummary {
  snapshot: Snapshot;
  narrative: Narrative | null;
  attempts: number;
}

export interface CompletionInput {
  leaseToken: string;
  generatedBy: 'GEMINI' | 'TEMPLATE';
  model: string | null;
  promptVersion: string;
  narrative: unknown;
}

const SELECT = Prisma.sql`id, status, source, snapshot, narrative, created_at, completed_at, deadline_at, attempts,
  next_attempt_at, lease_token_hash, lease_expires_at, generated_by, model, prompt_version, error_code, result_hash`;

const ACTIVE_INDEX = 'reports_one_active_idx';
const SCHEDULED_INDEX = 'reports_scheduled_day_idx';

class UniqueIndexHit extends Error {
  constructor(public readonly index: 'active' | 'scheduled') {
    super(index);
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function toSummary(r: ReportRow): ReportSummary {
  return {
    id: r.id,
    status: r.status,
    source: r.source,
    snapshotCapturedAt: r.snapshot.capturedAt,
    totalEmployees: r.snapshot.totalEmployees,
    createdAt: r.created_at.toISOString(),
    completedAt: r.status === 'SUCCEEDED' || r.status === 'FAILED' ? (r.completed_at?.toISOString() ?? null) : null,
    generatedBy: r.status === 'SUCCEEDED' ? r.generated_by : null,
    // TEMPLATE reports were not produced by a model (PRD §12.5).
    model: r.generated_by === 'TEMPLATE' && r.status === 'SUCCEEDED' ? null : r.model,
    promptVersion: r.prompt_version,
    errorCode: r.status === 'FAILED' ? r.error_code : null,
  };
}

export function toDetail(r: ReportRow): ReportDetail {
  return {
    ...toSummary(r),
    snapshot: r.snapshot,
    narrative: r.status === 'SUCCEEDED' ? r.narrative : null,
    attempts: r.attempts,
  };
}

function uniqueIndexOf(err: unknown): 'active' | 'scheduled' | null {
  if (!isUniqueViolation(err)) return null;
  const text = JSON.stringify((err as { meta?: unknown }).meta ?? {}) + String((err as Error).message ?? '');
  if (text.includes(SCHEDULED_INDEX)) return 'scheduled';
  if (text.includes(ACTIVE_INDEX)) return 'active';
  return pgErrorCode(err) === '23505' ? 'active' : null;
}

/**
 * Workforce Snapshot reports and the durable PostgreSQL job queue (PRD §12.2–12.3).
 * State machine: QUEUED → RUNNING (lease) → SUCCEEDED | QUEUED (retry) | FAILED.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly clock: Clock,
    private readonly logger: JsonLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Job events carry ids and counters only — never snapshot, narrative or lease token (PRD §13.4). */
  private event(message: string, fields: Record<string, unknown>): void {
    this.logger.write('info', message, fields);
  }

  private assertEnabled(): void {
    if (!this.config.reports.enabled) {
      throw new ApiException(503, 'AI_NOT_CONFIGURED', 'AI reports are not configured on this server yet.');
    }
  }

  private async activeReportId(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM reports WHERE status IN ('QUEUED', 'RUNNING') ORDER BY created_at LIMIT 1`;
    return rows[0]?.id ?? null;
  }

  private inProgress(currentReportId: string | null): ApiException {
    return new ApiException(409, 'REPORT_IN_PROGRESS', 'A report is already being generated.', undefined, { currentReportId });
  }

  private async insertReport(tx: Prisma.TransactionClient, source: 'MANUAL' | 'SCHEDULED', requestedBy: string | null): Promise<ReportRow> {
    const now = this.clock.now();
    const snapshot = await captureSnapshot(tx, now, this.config.timezone);
    try {
      const rows = await tx.$queryRaw<ReportRow[]>`
        INSERT INTO reports (id, status, snapshot, requested_by, source, generation_date, prompt_version, model,
                             created_at, deadline_at, attempts, next_attempt_at)
        VALUES (gen_random_uuid(), 'QUEUED', ${JSON.stringify(snapshot)}::jsonb, ${requestedBy}::uuid,
                ${source}::"ReportSource", ${snapshot.businessDate}::date, ${this.config.reports.promptVersion},
                ${this.config.reports.model}, ${now}, ${new Date(now.getTime() + this.config.reports.deadlineMs)}, 0, ${now})
        RETURNING ${SELECT}`;
      return rows[0];
    } catch (err) {
      const index = uniqueIndexOf(err);
      if (index) throw new UniqueIndexHit(index);
      throw err;
    }
  }

  /** Admin "Generate report": snapshot + QUEUED in one transaction; never waits for the model. */
  async createManual(actorId: string, idempotencyKey: string) {
    this.assertEnabled();
    try {
      return await this.idempotency.run<ReportSummary>(
        { scope: 'reports.create', actorId, key: idempotencyKey, requestHash: hashPayload({}) },
        async (tx) => {
          const now = this.clock.now();
          const windowStart = new Date(now.getTime() - 60 * 60_000);
          // Manual quota counts every manual report (failed ones too) across all admins.
          const recent = await tx.$queryRaw<{ created_at: Date }[]>`
            SELECT created_at FROM reports WHERE source = 'MANUAL' AND created_at > ${windowStart}
            ORDER BY created_at ASC`;
          if (recent.length >= this.config.reports.manualQuotaPerHour) {
            const retryAfter = Math.max(1, Math.ceil((recent[0].created_at.getTime() + 60 * 60_000 - now.getTime()) / 1000));
            throw new ApiException(429, 'REPORT_QUOTA_EXCEEDED', 'The hourly limit for manual reports has been reached.', undefined, undefined, {
              'Retry-After': String(retryAfter),
            });
          }
          const active = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM reports WHERE status IN ('QUEUED', 'RUNNING') LIMIT 1`;
          if (active.length > 0) throw this.inProgress(active[0].id);
          const row = await this.insertReport(tx, 'MANUAL', actorId);
          return { status: 202, body: toSummary(row) };
        },
      );
    } catch (err) {
      if (err instanceof UniqueIndexHit) throw this.inProgress(await this.activeReportId());
      throw err;
    }
  }

  /** Daily scheduled report: the server decides the business day; one per day (PRD §12.2). */
  async createScheduled(): Promise<{ status: 200 | 202; body: ReportSummary }> {
    this.assertEnabled();
    const day = businessDate(this.clock.now(), this.config.timezone);
    const existing = await this.findScheduled(day);
    if (existing) return { status: 200, body: toSummary(existing) };
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const active = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM reports WHERE status IN ('QUEUED', 'RUNNING') LIMIT 1`;
        if (active.length > 0) throw this.inProgress(active[0].id);
        return this.insertReport(tx, 'SCHEDULED', null);
      });
      return { status: 202, body: toSummary(row) };
    } catch (err) {
      if (err instanceof UniqueIndexHit) {
        if (err.index === 'scheduled') {
          const again = await this.findScheduled(day);
          if (again) return { status: 200, body: toSummary(again) };
        }
        throw this.inProgress(await this.activeReportId());
      }
      throw err;
    }
  }

  private async findScheduled(day: string): Promise<ReportRow | null> {
    const rows = await this.prisma.$queryRaw<ReportRow[]>`
      SELECT ${SELECT} FROM reports WHERE source = 'SCHEDULED' AND generation_date = ${day}::date`;
    return rows[0] ?? null;
  }

  async list(page: number, pageSize: number, status: ReportStatus | null) {
    const where = status ? Prisma.sql`WHERE status = ${status}::"ReportStatus"` : Prisma.empty;
    return this.prisma.$transaction(
      async (tx) => {
        const count = await tx.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM reports ${where}`;
        const total = count[0]?.total ?? 0;
        const offset = (page - 1) * pageSize;
        const rows =
          offset >= total
            ? []
            : await tx.$queryRaw<ReportRow[]>`
                SELECT ${SELECT} FROM reports ${where}
                ORDER BY created_at DESC, id DESC LIMIT ${pageSize} OFFSET ${offset}`;
        return { rows: rows.map(toSummary), total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async get(id: string): Promise<ReportDetail> {
    const rows = await this.prisma.$queryRaw<ReportRow[]>`SELECT ${SELECT} FROM reports WHERE id = ${id}::uuid`;
    if (!rows[0]) throw Errors.reportNotFound();
    return toDetail(rows[0]);
  }

  // ---------------------------------------------------------------- worker API

  private async heartbeat(): Promise<void> {
    const now = this.clock.now();
    await this.prisma.$executeRaw`
      INSERT INTO integration_state (key, last_worker_seen_at, flags, updated_at)
      VALUES ('report-worker', ${now}, '{}'::jsonb, ${now})
      ON CONFLICT (key) DO UPDATE SET last_worker_seen_at = EXCLUDED.last_worker_seen_at, updated_at = EXCLUDED.updated_at`;
  }

  /** Atomically leases at most one due job (SKIP LOCKED) and records the worker heartbeat. */
  async claim() {
    await this.heartbeat();
    const now = this.clock.now();
    const leaseToken = randomToken();
    const leaseExpiresAt = new Date(now.getTime() + this.config.reports.leaseMs);
    const rows = await this.prisma.$queryRaw<ReportRow[]>`
      WITH next AS (
        SELECT id FROM reports
        WHERE status = 'QUEUED' AND next_attempt_at <= ${now} AND deadline_at > ${now}
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE reports r
      SET status = 'RUNNING', attempts = r.attempts + 1,
          lease_token_hash = ${sha256(leaseToken)}, lease_expires_at = ${leaseExpiresAt}
      FROM next WHERE r.id = next.id
      RETURNING r.id, r.status, r.source, r.snapshot, r.narrative, r.created_at, r.completed_at, r.deadline_at,
                r.attempts, r.next_attempt_at, r.lease_token_hash, r.lease_expires_at, r.generated_by, r.model,
                r.prompt_version, r.error_code, r.result_hash`;
    const job = rows[0];
    if (!job) return null;
    this.event('report_job_claimed', { reportId: job.id, attempt: job.attempts });
    return {
      reportId: job.id,
      leaseToken,
      leaseExpiresAt: leaseExpiresAt.toISOString(),
      attempt: job.attempts,
      model: job.model,
      promptVersion: job.prompt_version,
      snapshot: job.snapshot,
    };
  }

  private staleLease(): ApiException {
    return new ApiException(409, 'STALE_LEASE', 'This lease is no longer valid for the report.');
  }

  private async lockReport(tx: Prisma.TransactionClient, id: string): Promise<ReportRow> {
    const rows = await tx.$queryRaw<ReportRow[]>`SELECT ${SELECT} FROM reports WHERE id = ${id}::uuid FOR UPDATE`;
    if (!rows[0]) throw Errors.reportNotFound();
    return rows[0];
  }

  private leaseValid(row: ReportRow, leaseToken: string, now: Date): boolean {
    return (
      row.status === 'RUNNING' &&
      row.lease_token_hash === sha256(leaseToken) &&
      row.lease_expires_at !== null &&
      row.lease_expires_at.getTime() > now.getTime() &&
      row.deadline_at.getTime() > now.getTime()
    );
  }

  async complete(id: string, input: CompletionInput): Promise<{ reportId: string; status: ReportStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockReport(tx, id);
      const now = this.clock.now();
      const narrative = narrativeRule(input.narrative);
      const resultHash = narrative.ok
        ? sha256(canonicalJson({ generatedBy: input.generatedBy, model: input.model, promptVersion: input.promptVersion, narrative: narrative.value }))
        : null;

      // Duplicate delivery of the same terminal result from the same lease is a no-op (PRD §12.3).
      if (row.status === 'SUCCEEDED' && row.lease_token_hash === sha256(input.leaseToken)) {
        if (resultHash !== null && row.result_hash === resultHash) return { reportId: row.id, status: row.status };
        throw new ApiException(409, 'REPORT_ALREADY_COMPLETED', 'This report already has a different result.');
      }
      if (!this.leaseValid(row, input.leaseToken, now)) throw this.staleLease();
      if (!narrative.ok) {
        throw Errors.validation([{ field: 'narrative', code: narrative.code, message: narrative.message }]);
      }

      const problems: { field: string; code: string; message: string }[] = [];
      if (input.promptVersion !== row.prompt_version) {
        problems.push({ field: 'promptVersion', code: 'PROMPT_VERSION_MISMATCH', message: 'promptVersion does not match the job.' });
      }
      if (input.generatedBy === 'GEMINI') {
        if (input.model !== row.model) problems.push({ field: 'model', code: 'MODEL_MISMATCH', message: 'model does not match the job.' });
        if (row.snapshot.totalEmployees === 0) {
          problems.push({ field: 'generatedBy', code: 'GENERATOR_MISMATCH', message: 'Empty snapshots must use the TEMPLATE generator.' });
        }
      } else if (input.model !== null || row.snapshot.totalEmployees !== 0) {
        problems.push({ field: 'generatedBy', code: 'GENERATOR_MISMATCH', message: 'TEMPLATE is only allowed for an empty snapshot with model=null.' });
      }
      if (problems.length) throw Errors.validation(problems);

      await tx.$executeRaw`
        UPDATE reports SET status = 'SUCCEEDED', narrative = ${JSON.stringify(narrative.value)}::jsonb,
          generated_by = ${input.generatedBy}::"ReportGenerator", completed_at = ${now}, error_code = NULL,
          result_hash = ${resultHash}, lease_expires_at = NULL
        WHERE id = ${row.id}::uuid`;
      this.event('report_job_succeeded', { reportId: row.id, attempt: row.attempts, generatedBy: input.generatedBy });
      return { reportId: row.id, status: 'SUCCEEDED' as const };
    });
  }

  async fail(id: string, leaseToken: string, errorCode: string): Promise<{ reportId: string; status: ReportStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockReport(tx, id);
      const now = this.clock.now();
      if (!this.leaseValid(row, leaseToken, now)) throw this.staleLease();
      const { maxAttempts, backoffMs } = this.config.reports;
      const delay = isRetryable(errorCode) ? nextRetryDelayMs(row.attempts, maxAttempts, backoffMs) : null;
      if (delay !== null) {
        await tx.$executeRaw`
          UPDATE reports SET status = 'QUEUED', next_attempt_at = ${new Date(now.getTime() + delay)},
            lease_token_hash = NULL, lease_expires_at = NULL, error_code = ${errorCode}
          WHERE id = ${row.id}::uuid`;
        this.event('report_job_retry_scheduled', { reportId: row.id, attempt: row.attempts, errorCode, delayMs: delay });
        return { reportId: row.id, status: 'QUEUED' as const };
      }
      await tx.$executeRaw`
        UPDATE reports SET status = 'FAILED', completed_at = ${now}, error_code = ${errorCode},
          lease_token_hash = NULL, lease_expires_at = NULL
        WHERE id = ${row.id}::uuid`;
      this.event('report_job_failed', { reportId: row.id, attempt: row.attempts, errorCode });
      return { reportId: row.id, status: 'FAILED' as const };
    });
  }

  /**
   * Maintenance (every 30s): deadline → FAILED; expired lease → retry or FAILED.
   * Runs inside the API so recovery works even when n8n is down (PRD §12.3).
   */
  async runMaintenance(): Promise<{ deadlineFailed: number; leasesRecovered: number }> {
    const now = this.clock.now();
    const deadlineFailed = await this.prisma.$executeRaw`
      UPDATE reports SET status = 'FAILED', error_code = ${SYSTEM_ERROR_CODES.deadline}, completed_at = ${now},
        lease_token_hash = NULL, lease_expires_at = NULL
      WHERE status IN ('QUEUED', 'RUNNING') AND deadline_at <= ${now}`;

    const leasesRecovered = await this.prisma.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<{ id: string; attempts: number }[]>`
        SELECT id, attempts FROM reports
        WHERE status = 'RUNNING' AND lease_expires_at <= ${now}
        FOR UPDATE SKIP LOCKED`;
      const { maxAttempts, backoffMs } = this.config.reports;
      for (const job of expired) {
        const delay = nextRetryDelayMs(job.attempts, maxAttempts, backoffMs);
        if (delay !== null) {
          await tx.$executeRaw`
            UPDATE reports SET status = 'QUEUED', next_attempt_at = ${new Date(now.getTime() + delay)},
              lease_token_hash = NULL, lease_expires_at = NULL, error_code = ${SYSTEM_ERROR_CODES.leaseExpired}
            WHERE id = ${job.id}::uuid`;
        } else {
          await tx.$executeRaw`
            UPDATE reports SET status = 'FAILED', completed_at = ${now}, error_code = ${SYSTEM_ERROR_CODES.leaseExpired},
              lease_token_hash = NULL, lease_expires_at = NULL
            WHERE id = ${job.id}::uuid`;
        }
      }
      return expired.length;
    });
    return { deadlineFailed, leasesRecovered };
  }

  async workerLastSeenAt(): Promise<Date | null> {
    const rows = await this.prisma.$queryRaw<{ last_worker_seen_at: Date | null }[]>`
      SELECT last_worker_seen_at FROM integration_state WHERE key = 'report-worker'`;
    return rows[0]?.last_worker_seen_at ?? null;
  }
}
