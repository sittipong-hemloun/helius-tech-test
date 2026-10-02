import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type pg from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { PrismaService } from './prisma.service.js';
import { createSessionPool, SESSION_POOL } from './session-pool.js';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: SESSION_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createSessionPool(config.databaseUrl),
    },
  ],
  exports: [PrismaService, SESSION_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(SESSION_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
