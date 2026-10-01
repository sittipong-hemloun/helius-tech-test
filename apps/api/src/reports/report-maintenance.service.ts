import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { JsonLogger } from '../common/json-logger.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { ReportsService } from './reports.service.js';

/** In-process maintenance loop (single API instance). Disabled in tests, which drive it with a fake clock. */
@Injectable()
export class ReportMaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly reports: ReportsService,
    private readonly idempotency: IdempotencyService,
    private readonly logger: JsonLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.reports.maintenanceEnabled) return;
    this.timer = setInterval(() => void this.tick(), this.config.reports.maintenanceIntervalMs);
    this.timer.unref();
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.reports.runMaintenance();
      const purged = await this.idempotency.purgeExpired();
      if (result.deadlineFailed || result.leasesRecovered || purged) {
        this.logger.write('info', 'report_maintenance', { ...result, idempotencyPurged: purged });
      }
    } catch (err) {
      this.logger.write('warn', 'report_maintenance_failed', { errorName: (err as Error)?.name });
    } finally {
      this.running = false;
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
