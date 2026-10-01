import { Controller, Get, Module, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Public, RateLimit } from '../auth/auth.decorators.js';
import { PrismaService } from '../database/prisma.service.js';

/** Latest migration bundled with this build; readiness requires it to be applied. */
export function latestMigrationName(dir = resolve(import.meta.dirname, '../../prisma/migrations')): string | null {
  try {
    const names = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    return names.at(-1) ?? null;
  } catch {
    return null;
  }
}

/** Liveness = process answers; readiness = DB reachable + schema at the expected migration (PRD §13.4). */
@ApiExcludeController()
@Controller('api/health')
export class HealthController {
  private readonly expectedMigration = latestMigrationName();

  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @Public()
  @RateLimit('none')
  live(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok' });
  }

  @Get('ready')
  @Public()
  @RateLimit('none')
  async ready(@Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const rows = await this.prisma.$queryRaw<{ migration_name: string }[]>`
        SELECT migration_name FROM _prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      const applied = new Set(rows.map((r) => r.migration_name));
      if (this.expectedMigration && !applied.has(this.expectedMigration)) {
        res.status(503).json({ status: 'not_ready' });
        return;
      }
      res.status(200).json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
