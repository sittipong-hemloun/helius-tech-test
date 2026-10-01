import { Controller, Get, Module } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({ type: DepartmentDto, isArray: true })
  async list() {
    const rows = await this.prisma.department.findMany({ orderBy: { sortOrder: 'asc' } });
    return respond(rows.map((d) => ({ id: d.id, name: d.name, sortOrder: d.sortOrder })));
  }
}

@Module({ controllers: [DepartmentsController] })
export class DepartmentsModule {}
