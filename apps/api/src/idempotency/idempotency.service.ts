import { Inject, Injectable } from '@nestjs/common';
import { ApiException, Errors } from '../common/api-exception.js';
import { Clock } from '../common/clock.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface StoredResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

type Tx = Prisma.TransactionClient;

class ReplayRequired extends Error {}

/**
 * Create-once semantics for POST employees (PRD §10.5).
 * The key row is inserted first with ON CONFLICT DO NOTHING inside the same
 * transaction as the business write: a concurrent request with the same key blocks
 * on the unique index, then replays the committed result instead of creating a row.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async run<T>(
    params: { scope: string; key: string; requestHash: string },
    work: (tx: Tx) => Promise<{ status: number; body: T }>,
  ): Promise<StoredResult<T>> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const now = this.clock.now();
          await tx.$executeRaw`
            DELETE FROM idempotency_keys
            WHERE scope = ${params.scope} AND key = ${params.key}::uuid AND expires_at <= ${now}`;
          const inserted = await tx.$queryRaw<{ id: bigint }[]>`
            INSERT INTO idempotency_keys (scope, key, request_hash, created_at, expires_at)
            VALUES (${params.scope}, ${params.key}::uuid, ${params.requestHash},
                    ${now}, ${new Date(now.getTime() + this.config.idempotencyTtlMs)})
            ON CONFLICT (scope, key) DO NOTHING
            RETURNING id`;
          if (inserted.length === 0) throw new ReplayRequired();
          const result = await work(tx);
          await tx.$executeRaw`
            UPDATE idempotency_keys
            SET response_status = ${result.status}, response_body = ${JSON.stringify(result.body)}::jsonb
            WHERE id = ${inserted[0].id}`;
          return { ...result, replayed: false };
        });
      } catch (err) {
        if (!(err instanceof ReplayRequired)) throw err;
      }

      const rows = await this.prisma.$queryRaw<{ request_hash: string; response_status: number | null; response_body: unknown }[]>`
        SELECT request_hash, response_status, response_body FROM idempotency_keys
        WHERE scope = ${params.scope} AND key = ${params.key}::uuid AND expires_at > ${this.clock.now()}`;
      const row = rows[0];
      if (!row) continue; // the other request rolled back or expired: try once more as a fresh request
      if (row.request_hash !== params.requestHash) throw Errors.idempotencyConflict();
      if (row.response_status === null) {
        throw new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'A request with this Idempotency-Key is still being processed.');
      }
      return { status: row.response_status, body: row.response_body as T, replayed: true };
    }
    throw new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'A request with this Idempotency-Key is still being processed.');
  }

  async purgeExpired(): Promise<number> {
    return this.prisma.$executeRaw`DELETE FROM idempotency_keys WHERE expires_at <= ${this.clock.now()}`;
  }
}
