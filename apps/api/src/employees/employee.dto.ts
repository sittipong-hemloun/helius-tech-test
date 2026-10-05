import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export const DEPARTMENT_IDS = ['engineering', 'marketing', 'sales', 'hr'] as const;
export const SORT_FIELDS = ['id', 'name', 'department', 'salary', 'joinDate', 'isActive', 'lastUpdatedDate'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

/** "  Zoë " → "Zoë": trim and NFC-normalize text before it is validated and stored. */
const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.normalize('NFC').trim() : value);

/** The five fields a user may set. ID, Last Updated Date and version belong to the server. */
export class CreateEmployeeDto {
  @ApiProperty({ example: 'Dana Lee', maxLength: 100 })
  @Transform(trimmed)
  @IsString({ message: 'Name is required.' })
  @Length(1, 100, { message: 'Name must be 1–100 characters.' })
  @Matches(/^\P{Cc}*$/u, { message: 'Name cannot contain line breaks or control characters.' })
  name: string;

  @ApiProperty({ enum: DEPARTMENT_IDS, example: 'engineering' })
  @IsIn(DEPARTMENT_IDS, { message: 'Choose a department: engineering, marketing, sales or hr.' })
  departmentId: string;

  /** A decimal string, never a JSON number, so no floating-point rounding can happen on the way. */
  @ApiProperty({ example: '62000.00', description: 'Decimal string, at most 2 decimal places' })
  @IsString({ message: 'Salary must be sent as a string, e.g. "65000.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, { message: 'Salary must be a positive number with at most 2 decimal places.' })
  salary: string;

  @ApiProperty({ example: '2026-09-01', format: 'date' })
  @Matches(/^(19\d\d|20\d\d|2100)-\d\d-\d\d$/, { message: 'Join date must be YYYY-MM-DD between 1900 and 2100.' })
  @IsISO8601({ strict: true }, { message: 'Join date is not a real calendar date.' })
  joinDate: string;

  @ApiProperty({ example: true, description: 'true = Active, false = In Active' })
  @IsBoolean({ message: 'isActive must be true or false.' })
  isActive: boolean;
}

/** PATCH: any subset of the create fields. A field sent as null is still validated (and rejected). */
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto, { skipNullProperties: false }) {}

export class ListEmployeesQuery {
  @ApiPropertyOptional({ description: 'Part of the name, case-insensitive' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: DEPARTMENT_IDS })
  @IsOptional()
  @IsIn(DEPARTMENT_IDS)
  departmentId?: string;

  @ApiPropertyOptional({ enum: ['all', 'active', 'inactive'], default: 'all' })
  @IsIn(['all', 'active', 'inactive'])
  status: 'all' | 'active' | 'inactive' = 'all';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'id' })
  @IsIn(SORT_FIELDS)
  sortBy: SortField = 'id';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
