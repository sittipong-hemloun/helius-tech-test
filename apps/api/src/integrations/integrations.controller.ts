import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../common/openapi.js';
import { Roles } from '../auth/auth.decorators.js';
import { Clock } from '../common/clock.js';
import { respond } from '../common/envelope.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { ReportsModule } from '../reports/reports.module.js';
import { ReportsService } from '../reports/reports.service.js';

class GoogleStatusDto {
  @ApiProperty() configured: boolean;
}
class ReportsStatusDto {
  @ApiProperty() enabled: boolean;
  @ApiProperty() model: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) workerLastSeenAt: string | null;
  @ApiProperty() workerAvailable: boolean;
}
class BuildDto {
  @ApiProperty() commitSha: string;
  @ApiProperty() appVersion: string;
}
export class IntegrationStatusDto {
  @ApiProperty({ type: GoogleStatusDto }) google: GoogleStatusDto;
  @ApiProperty({ type: ReportsStatusDto }) reports: ReportsStatusDto;
  @ApiProperty({ type: BuildDto }) build: BuildDto;
}

/** Admin-only, read-only configuration presence (never values). "configured" ≠ live-tested (PRD §13.4). */
@ApiTags('integrations')
@Controller('api/v1/integrations')
export class IntegrationsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('status')
  @Roles('ADMIN')
  @ApiEnvelope(IntegrationStatusDto)
  @ApiErrors(401, 403, 429)
  async status() {
    const lastSeen = await this.reports.workerLastSeenAt();
    const workerAvailable = lastSeen !== null && this.clock.now().getTime() - lastSeen.getTime() <= this.config.reports.workerStaleMs;
    return respond({
      google: { configured: this.config.google.configured },
      reports: {
        enabled: this.config.reports.enabled,
        model: this.config.reports.model,
        workerLastSeenAt: lastSeen?.toISOString() ?? null,
        workerAvailable,
      },
      build: { commitSha: this.config.build.commitSha, appVersion: this.config.build.appVersion },
    });
  }
}

@Module({ imports: [ReportsModule], controllers: [IntegrationsController] })
export class IntegrationsModule {}
