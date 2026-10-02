import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Res, UsePipes } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors, ApiNoContent, ChangedMetaDto, EmployeeListMetaDto, Headers as H } from '../common/openapi.js';
import type { Response } from 'express';
import { Errors } from '../common/api-exception.js';
import { respond } from '../common/envelope.js';
import { parseIdempotencyKey } from '../idempotency/idempotency.js';
import { bodyValidationPipe, queryValidationPipe } from '../validation/validation.pipe.js';
import { unwrap } from '../validation/rule.js';
import { CreateEmployeeDto, EmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from './employee.dto.js';
import {
  departmentFilterRule,
  pageRule,
  pageSizeRule,
  qRule,
  sortByRule,
  sortOrderRule,
  statusFilterRule,
  type ListQuery,
} from './employee-query.js';
import type { EmployeeFields } from './employee-rules.js';
import { EmployeesService, type EmployeeRow } from './employees.service.js';

function parseId(raw: string): number {
  if (!/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > 2_147_483_647) throw Errors.employeeNotFound();
  return Number(raw);
}

/** If-Match: "<version>" (quoted per RFC 9110; a bare integer is accepted for tooling). */
export function parseIfMatch(header: string | undefined): number {
  if (header === undefined || header.trim() === '') throw Errors.preconditionRequired();
  const m = /^(?:W\/)?"?(\d{1,9})"?$/.exec(header.trim());
  if (!m) throw Errors.validation([{ field: 'If-Match', code: 'IF_MATCH_INVALID', message: 'If-Match must be the quoted employee version, e.g. "3".' }]);
  return Number(m[1]);
}

@ApiTags('employees')
@Controller('api/v1/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @UsePipes(queryValidationPipe)
  @ApiEnvelope(EmployeeDto, { isArray: true, meta: EmployeeListMetaDto })
  @ApiErrors(400, 429)
  async list(@Query() raw: ListEmployeesQueryDto) {
    const query: ListQuery = {
      q: raw.q === undefined ? '' : unwrap(qRule(raw.q)),
      departmentId: raw.departmentId === undefined ? null : unwrap(departmentFilterRule(raw.departmentId)),
      status: raw.status === undefined ? 'all' : unwrap(statusFilterRule(raw.status)),
      page: raw.page === undefined ? 1 : unwrap(pageRule(raw.page)),
      pageSize: raw.pageSize === undefined ? 20 : unwrap(pageSizeRule(raw.pageSize)),
      sortBy: raw.sortBy === undefined ? 'id' : unwrap(sortByRule(raw.sortBy)),
      sortOrder: raw.sortOrder === undefined ? 'asc' : unwrap(sortOrderRule(raw.sortOrder)),
    };
    const { rows, total } = await this.employees.list(query);
    return respond(rows, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get(':id')
  @ApiEnvelope(EmployeeDto, { headers: H.etag })
  @ApiErrors(404, 429)
  async get(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const row = await this.employees.get(parseId(id));
    res.setHeader('ETag', `"${row.version}"`);
    return respond(row);
  }

  @Post()
  @UsePipes(bodyValidationPipe)
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID generated once per create intent' })
  @ApiEnvelope(EmployeeDto, { status: 201, headers: { ...H.etag, ...H.location, ...H.replayed } })
  @ApiErrors(400, 409, 413, 415, 429)
  async create(
    @Body() body: CreateEmployeeDto,
    @Headers('idempotency-key') keyHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = parseIdempotencyKey(keyHeader);
    const result = await this.employees.create(body as EmployeeFields, key);
    const row = result.body as EmployeeRow;
    res.status(result.status);
    res.setHeader('Location', `/api/v1/employees/${row.id}`);
    res.setHeader('ETag', `"${row.version}"`);
    if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
    return respond(row);
  }

  @Patch(':id')
  @UsePipes(bodyValidationPipe)
  @ApiHeader({ name: 'If-Match', required: true, description: 'Quoted employee version, e.g. "1"' })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiEnvelope(EmployeeDto, { meta: ChangedMetaDto, headers: H.etag })
  @ApiErrors(400, 404, 409, 413, 415, 428, 429)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateEmployeeDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const employeeId = parseId(id);
    if (Object.keys(body ?? {}).length === 0) {
      throw Errors.validation([{ field: 'body', code: 'EMPTY_PATCH', message: 'Send at least one field to update.' }]);
    }
    const version = parseIfMatch(ifMatch);
    const { employee, changed } = await this.employees.update(employeeId, body as Partial<EmployeeFields>, version);
    res.setHeader('ETag', `"${employee.version}"`);
    return respond(employee, { changed });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiHeader({ name: 'If-Match', required: true })
  @ApiNoContent('Deleted')
  @ApiErrors(400, 404, 409, 428, 429)
  async remove(@Param('id') id: string, @Headers('if-match') ifMatch: string | undefined): Promise<void> {
    const employeeId = parseId(id);
    await this.employees.remove(employeeId, parseIfMatch(ifMatch));
  }
}
