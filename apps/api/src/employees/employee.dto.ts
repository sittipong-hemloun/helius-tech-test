import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rule } from '../validation/field-rule.decorator.js';
import { departmentRule, isActiveRule, joinDateRule, nameRule, salaryRule, DEPARTMENT_IDS } from './employee-rules.js';
import {
  departmentFilterRule,
  pageRule,
  pageSizeRule,
  qRule,
  SORT_FIELDS,
  sortByRule,
  sortOrderRule,
  STATUS_FILTERS,
  statusFilterRule,
} from './employee-query.js';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Dana Lee', maxLength: 100, description: 'Trimmed and NFC-normalized; 1–100 code points.' })
  @Rule(nameRule)
  name: string;

  @ApiProperty({ enum: DEPARTMENT_IDS, example: 'engineering' })
  @Rule(departmentRule)
  departmentId: string;

  @ApiProperty({ type: String, example: '62000.00', pattern: '^\\d{1,10}(\\.\\d{1,2})?$', description: 'Decimal string, 0–9999999999.99' })
  @Rule(salaryRule)
  salary: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-09-01' })
  @Rule(joinDateRule)
  joinDate: string;

  @ApiProperty({ type: Boolean, example: true, description: 'true = Active, false = In Active' })
  @Rule(isActiveRule)
  isActive: boolean;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Dana Lee', maxLength: 100 })
  @Rule(nameRule, { optional: true })
  name?: string;

  @ApiPropertyOptional({ enum: DEPARTMENT_IDS })
  @Rule(departmentRule, { optional: true })
  departmentId?: string;

  @ApiPropertyOptional({ type: String, example: '63000.00' })
  @Rule(salaryRule, { optional: true })
  salary?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @Rule(joinDateRule, { optional: true })
  joinDate?: string;

  @ApiPropertyOptional({ type: Boolean })
  @Rule(isActiveRule, { optional: true })
  isActive?: boolean;
}

export class ListEmployeesQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive name contains; trimmed; ≤100 characters' })
  @Rule(qRule, { optional: true })
  q?: string;

  @ApiPropertyOptional({ enum: DEPARTMENT_IDS })
  @Rule(departmentFilterRule, { optional: true })
  departmentId?: string;

  @ApiPropertyOptional({ enum: STATUS_FILTERS, default: 'all' })
  @Rule(statusFilterRule, { optional: true })
  status?: string;

  @ApiPropertyOptional({ type: Integer(), default: 1, minimum: 1, maximum: 1_000_000 })
  @Rule(pageRule, { optional: true })
  page?: string;

  @ApiPropertyOptional({ type: Integer(), default: 20, minimum: 1, maximum: 100 })
  @Rule(pageSizeRule, { optional: true })
  pageSize?: string;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'id', description: 'salary is Admin-only' })
  @Rule(sortByRule, { optional: true })
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @Rule(sortOrderRule, { optional: true })
  sortOrder?: string;
}

function Integer(): 'integer' {
  return 'integer';
}

export class EmployeeDto {
  @ApiProperty({ example: 106 }) id: number;
  @ApiProperty({ example: 'Dana Lee' }) name: string;
  @ApiProperty({ enum: DEPARTMENT_IDS }) departmentId: string;
  @ApiProperty({ example: 'Engineering' }) departmentName: string;
  @ApiPropertyOptional({ type: String, example: '62000.00', description: 'Present for Admin only; the key is omitted for Viewer.' })
  salary?: string;
  @ApiProperty({ type: String, format: 'date', example: '2026-09-01' }) joinDate: string;
  @ApiProperty({ example: true }) isActive: boolean;
  @ApiProperty({ type: String, format: 'date', example: '2026-10-01' }) lastUpdatedDate: string;
  @ApiProperty({ example: 1 }) version: number;
}
