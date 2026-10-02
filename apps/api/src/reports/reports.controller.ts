import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UsePipes } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors, Headers as H, PageMetaDto } from '../common/openapi.js';
import type { Response } from 'express';
import { Errors } from '../common/api-exception.js';
import { respond } from '../common/envelope.js';
import type { AppRequest } from '../common/request-context.js';
import { Roles } from '../auth/auth.decorators.js';
import { parseIdempotencyKey } from '../idempotency/idempotency.js';
import { bodyValidationPipe, queryValidationPipe } from '../validation/validation.pipe.js';
import { CreateReportDto, ListReportsQueryDto, ReportDetailDto, ReportSummaryDto } from './report.dto.js';
import { ReportsService, type ReportStatus } from './reports.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseReportId(raw: string): string {
  if (!UUID.test(raw)) throw Errors.reportNotFound();
  return raw.toLowerCase();
}

@ApiTags('reports')
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @UsePipes(queryValidationPipe)
  @ApiEnvelope(ReportSummaryDto, { isArray: true, meta: PageMetaDto, description: 'Newest first (createdAt desc, id desc)' })
  @ApiErrors(400, 401, 403, 429)
  async list(@Query() q: ListReportsQueryDto) {
    const page = q.page ? Number(q.page) : 1;
    const pageSize = q.pageSize ? Number(q.pageSize) : 20;
    const { rows, total } = await this.reports.list(page, pageSize, (q.status as ReportStatus | undefined) ?? null);
    return respond(rows, { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) });
  }

  @Get(':id')
  @ApiEnvelope(ReportDetailDto)
  @ApiErrors(401, 403, 404, 429)
  async get(@Param('id') id: string) {
    return respond(await this.reports.get(parseReportId(id)));
  }

  @Post()
  @Roles('ADMIN')
  @UsePipes(bodyValidationPipe)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiEnvelope(ReportSummaryDto, { status: 202, description: 'Queued; poll GET /api/v1/reports/{id}', headers: { ...H.location, ...H.replayed } })
  @ApiErrors(400, 401, 403, 409, 429, 503)
  async create(
    @Body() _body: CreateReportDto,
    @Headers('idempotency-key') keyHeader: string | undefined,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = parseIdempotencyKey(keyHeader);
    const result = await this.reports.createManual(req.principal!.userId, key);
    res.status(result.status);
    res.setHeader('Location', `/api/v1/reports/${result.body.id}`);
    if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
    return respond(result.body);
  }
}
