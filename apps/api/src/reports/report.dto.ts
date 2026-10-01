import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rule } from '../validation/field-rule.decorator.js';
import { fail, ok, type RuleResult } from '../validation/rule.js';
import { intRule } from '../employees/employee-query.js';
import { WORKER_ERROR_CODES } from './report-rules.js';

export const REPORT_STATUSES = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const;

const statusRule = (v: unknown): RuleResult<string> =>
  typeof v === 'string' && (REPORT_STATUSES as readonly string[]).includes(v)
    ? ok(v)
    : fail('STATUS_INVALID', 'status must be QUEUED, RUNNING, SUCCEEDED or FAILED.');

const leaseTokenRule = (v: unknown): RuleResult<string> =>
  typeof v === 'string' && v.length >= 16 && v.length <= 200 ? ok(v) : fail('LEASE_TOKEN_INVALID', 'leaseToken is required.');

const generatedByRule = (v: unknown): RuleResult<string> =>
  v === 'GEMINI' || v === 'TEMPLATE' ? ok(v) : fail('GENERATED_BY_INVALID', 'generatedBy must be GEMINI or TEMPLATE.');

const modelRule = (v: unknown): RuleResult<string | null> =>
  v === null || (typeof v === 'string' && v.length > 0 && v.length <= 100) ? ok(v) : fail('MODEL_INVALID', 'model must be a string or null.');

const promptVersionRule = (v: unknown): RuleResult<string> =>
  typeof v === 'string' && v.length > 0 && v.length <= 50 ? ok(v) : fail('PROMPT_VERSION_INVALID', 'promptVersion is required.');

const narrativeShapeRule = (v: unknown): RuleResult<unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? ok(v) : fail('NARRATIVE_INVALID', 'narrative must be an object.');

const errorCodeRule = (v: unknown): RuleResult<string> =>
  typeof v === 'string' && (WORKER_ERROR_CODES as readonly string[]).includes(v)
    ? ok(v)
    : fail('ERROR_CODE_INVALID', `errorCode must be one of ${WORKER_ERROR_CODES.join(', ')}.`);

export class ListReportsQueryDto {
  @ApiPropertyOptional({ type: 'integer', default: 1 })
  @Rule(intRule('page', 1, 1_000_000), { optional: true })
  page?: string;

  @ApiPropertyOptional({ type: 'integer', default: 20, maximum: 100 })
  @Rule(intRule('pageSize', 1, 100), { optional: true })
  pageSize?: string;

  @ApiPropertyOptional({ enum: REPORT_STATUSES })
  @Rule(statusRule, { optional: true })
  status?: string;
}

/** POST /api/v1/reports takes an empty object. */
export class CreateReportDto {}

export class CompleteReportJobDto {
  @ApiProperty() @Rule(leaseTokenRule) leaseToken: string;
  @ApiProperty({ enum: ['GEMINI', 'TEMPLATE'] }) @Rule(generatedByRule) generatedBy: 'GEMINI' | 'TEMPLATE';
  @ApiProperty({ type: String, nullable: true, example: 'gemini-3.5-flash-lite' }) @Rule(modelRule) model: string | null;
  @ApiProperty({ example: 'employee-summary-v1' }) @Rule(promptVersionRule) promptVersion: string;
  @ApiProperty({ example: { headline: 'ภาพรวมพนักงาน', bullets: ['...', '...', '...'] } })
  @Rule(narrativeShapeRule)
  narrative: unknown;
}

export class FailReportJobDto {
  @ApiProperty() @Rule(leaseTokenRule) leaseToken: string;
  @ApiProperty({ enum: WORKER_ERROR_CODES }) @Rule(errorCodeRule) errorCode: string;
}

export class EmptyBodyDto {}

class SnapshotDepartmentDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() total: number;
  @ApiProperty() active: number;
  @ApiProperty() inactive: number;
}

export class SnapshotDto {
  @ApiProperty({ enum: [1] }) schemaVersion: 1;
  @ApiProperty({ format: 'date-time' }) capturedAt: string;
  @ApiProperty({ format: 'date' }) businessDate: string;
  @ApiProperty({ enum: ['Asia/Bangkok'] }) timezone: 'Asia/Bangkok';
  @ApiProperty() totalEmployees: number;
  @ApiProperty() activeEmployees: number;
  @ApiProperty() inactiveEmployees: number;
  @ApiProperty({ type: SnapshotDepartmentDto, isArray: true }) departments: SnapshotDepartmentDto[];
}

export class NarrativeDto {
  @ApiProperty() headline: string;
  @ApiProperty({ type: String, isArray: true }) bullets: string[];
}

export class ReportSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: REPORT_STATUSES }) status: string;
  @ApiProperty({ enum: ['MANUAL', 'SCHEDULED'] }) source: string;
  @ApiProperty({ format: 'date-time' }) snapshotCapturedAt: string;
  @ApiProperty() totalEmployees: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt: string | null;
  @ApiProperty({ type: String, enum: ['GEMINI', 'TEMPLATE'], nullable: true }) generatedBy: string | null;
  @ApiProperty({ type: String, nullable: true }) model: string | null;
  @ApiProperty() promptVersion: string;
  @ApiProperty({ type: String, nullable: true }) errorCode: string | null;
}

export class ReportDetailDto extends ReportSummaryDto {
  @ApiProperty({ type: SnapshotDto }) snapshot: SnapshotDto;
  @ApiProperty({ type: NarrativeDto, nullable: true }) narrative: NarrativeDto | null;
  @ApiProperty() attempts: number;
}

export class ClaimedReportJobDto {
  @ApiProperty({ format: 'uuid' }) reportId: string;
  @ApiProperty() leaseToken: string;
  @ApiProperty({ format: 'date-time' }) leaseExpiresAt: string;
  @ApiProperty() attempt: number;
  @ApiProperty() model: string;
  @ApiProperty() promptVersion: string;
  @ApiProperty({ type: SnapshotDto }) snapshot: SnapshotDto;
}

export class JobStatusDto {
  @ApiProperty({ format: 'uuid' }) reportId: string;
  @ApiProperty({ enum: REPORT_STATUSES }) status: string;
}
