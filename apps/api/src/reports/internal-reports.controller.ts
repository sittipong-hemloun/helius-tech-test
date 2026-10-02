import { Body, Controller, HttpCode, Param, Post, Res, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../common/openapi.js';
import type { Response } from 'express';
import { respond } from '../common/envelope.js';
import { RateLimit, ServiceAuth } from '../auth/auth.decorators.js';
import { bodyValidationPipe } from '../validation/validation.pipe.js';
import { ClaimedReportJobDto, CompleteReportJobDto, EmptyBodyDto, FailReportJobDto, JobStatusDto, ReportSummaryDto } from './report.dto.js';
import { parseReportId } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/**
 * Worker/scheduler endpoints for n8n (PRD §10.2). Never proxied by Next.js and
 * reachable only on the Docker network; each route accepts exactly one token scope.
 */
@ApiTags('internal')
@ApiBearerAuth()
@Controller('internal/v1')
export class InternalReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('report-jobs/claim')
  @HttpCode(200)
  @ServiceAuth('worker')
  @RateLimit('claim')
  @UsePipes(bodyValidationPipe)
  @ApiEnvelope(ClaimedReportJobDto, { nullable: true, description: 'data is null when no job is due; updates the worker heartbeat' })
  @ApiErrors(400, 401, 429)
  async claim(@Body() _body: EmptyBodyDto) {
    return respond(await this.reports.claim());
  }

  @Post('report-jobs/:id/complete')
  @HttpCode(200)
  @ServiceAuth('worker')
  @RateLimit('none')
  @UsePipes(bodyValidationPipe)
  @ApiEnvelope(JobStatusDto)
  @ApiErrors(400, 401, 404, 409, 413)
  async complete(@Param('id') id: string, @Body() body: CompleteReportJobDto) {
    return respond(await this.reports.complete(parseReportId(id), body));
  }

  @Post('report-jobs/:id/fail')
  @HttpCode(200)
  @ServiceAuth('worker')
  @RateLimit('none')
  @UsePipes(bodyValidationPipe)
  @ApiEnvelope(JobStatusDto, { description: 'QUEUED (retry scheduled) or FAILED' })
  @ApiErrors(400, 401, 404, 409)
  async fail(@Param('id') id: string, @Body() body: FailReportJobDto) {
    return respond(await this.reports.fail(parseReportId(id), body.leaseToken, body.errorCode));
  }

  @Post('reports/scheduled')
  @ServiceAuth('scheduler')
  @RateLimit('none')
  @UsePipes(bodyValidationPipe)
  @ApiEnvelope(ReportSummaryDto, { status: 202, description: 'Created for today (Asia/Bangkok business day)' })
  @ApiEnvelope(ReportSummaryDto, { status: 200, description: "Today's scheduled report already exists" })
  @ApiErrors(400, 401, 409, 503)
  async scheduled(@Body() _body: EmptyBodyDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.reports.createScheduled();
    res.status(result.status);
    return respond(result.body);
  }
}
