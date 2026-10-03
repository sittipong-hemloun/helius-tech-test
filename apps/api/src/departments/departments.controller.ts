import { Controller, Get } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors } from '../common/openapi.js';
import { respond } from '../common/envelope.js';
import { PrismaService } from '../database/prisma.service.js';

export class DepartmentDto {
  @ApiProperty({ example: 'engineering' }) id: string;
  @ApiProperty({ example: 'Engineering' }) name: string;
  @ApiProperty({ example: 1 }) sortOrder: number;
}

@ApiTags('departments')
@Controller('api/v1/departments')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiEnvelope(DepartmentDto, { isArray: true })
  @ApiErrors(429)
  async list() {
    const rows = await this.prisma.department.findMany({ orderBy: { sortOrder: 'asc' } });
    return respond(rows.map((d) => ({ id: d.id, name: d.name, sortOrder: d.sortOrder })));
  }
}
