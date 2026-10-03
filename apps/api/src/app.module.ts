import { Module, type DynamicModule } from '@nestjs/common';
import type { Clock } from './common/clock.js';
import type { JsonLogger } from './common/json-logger.js';
import type { AppConfig } from './config/app-config.js';
import { CoreModule } from './core.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthModule } from './health/health.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';

/** Modular monolith: Controller → Service → Prisma (PRD §7.2). */
@Module({})
export class AppModule {
  static register(config: AppConfig, clock: Clock, logger: JsonLogger): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.register(config, clock, logger),
        DatabaseModule,
        RateLimitModule,
        EmployeesModule,
        DepartmentsModule,
        HealthModule,
      ],
    };
  }
}
