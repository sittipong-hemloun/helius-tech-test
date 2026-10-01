import { Module, type DynamicModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import type { Clock } from './common/clock.js';
import type { JsonLogger } from './common/json-logger.js';
import type { AppConfig } from './config/app-config.js';
import { CoreModule } from './core.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DepartmentsModule } from './departments/departments.controller.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthModule } from './health/health.controller.js';
import { IntegrationsModule } from './integrations/integrations.controller.js';
import { ReportsModule } from './reports/reports.module.js';

/** Modular monolith: Controller → Service → Prisma (PRD §7.2). */
@Module({})
export class AppModule {
  static register(config: AppConfig, clock: Clock, logger: JsonLogger): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.register(config, clock, logger),
        DatabaseModule,
        AuthModule,
        EmployeesModule,
        DepartmentsModule,
        ReportsModule,
        IntegrationsModule,
        HealthModule,
      ],
    };
  }
}
