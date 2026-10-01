import { Body, Controller, HttpCode, Param, Post, Res, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({ type: ClaimedReportJobDto })
  async claim(@Body() _body: EmptyBodyDto) {
    return respond(await this.reports.claim());
  }

  @Post('report-jobs/:id/complete')
  @HttpCode(200)
  @ServiceAuth('worker')
  @RateLimit('none')
  @UsePipes(bodyValidationPipe)
  @ApiOkResponse({ type: JobStatusDto })
  async complete(@Param('id') id: string, @Body() body: CompleteReportJobDto) {
    return respond(await this.reports.complete(parseReportId(id), body));
  }

  @Post('report-jobs/:id/fail')
  @HttpCode(200)
  @ServiceAuth('worker')
  @RateLimit('none')
  @UsePipes(bodyValidationPipe)
  @ApiOkResponse({ type: JobStatusDto })
  async fail(@Param('id') id: string, @Body() body: FailReportJobDto) {
    return respond(await this.reports.fail(parseReportId(id), body.leaseToken, body.errorCode));
  }

  @Post('reports/scheduled')
  @ServiceAuth('scheduler')
  @RateLimit('none')
  @UsePipes(bodyValidationPipe)
  @ApiOkResponse({ type: ReportSummaryDto })
  async scheduled(@Body() _body: EmptyBodyDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.reports.createScheduled();
    res.status(result.status);
    return respond(result.body);
  }
}
