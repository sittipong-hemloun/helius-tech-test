import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** Prisma 7 client over the pg driver adapter; the connection timezone is pinned to UTC (PRD §7.1). */
@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
        max: config.dbPoolMax,
        options: '-c TimeZone=UTC',
        application_name: `employee-console-api-${config.appEnv}`,
      }),
    });
  }

  /** Runs after the HTTP server closed, so in-flight requests keep their connections. */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}

export function createPrismaClient(databaseUrl: string, max = 5): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, max, options: '-c TimeZone=UTC' }),
  });
}
