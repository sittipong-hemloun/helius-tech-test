import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpException, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateEmployeeDto, ListEmployeesQuery, UpdateEmployeeDto } from './employee.dto.js';
import { EmployeesService } from './employees.service.js';

/** `If-Match: "3"` → 3. Edits and deletes must say which version of the record they are based on. */
function parseIfMatch(header: string | undefined): number {
  if (!header) throw new HttpException('Send If-Match with the employee version you edited.', HttpStatus.PRECONDITION_REQUIRED);
  const version = Number(header.replaceAll('"', ''));
  if (!Number.isInteger(version)) throw new BadRequestException('If-Match must be the employee version, e.g. "3".');
  return version;
}

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query() query: ListEmployeesQuery) {
    return this.employees.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.employees.get(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto, @Headers('if-match') ifMatch?: string) {
    return this.employees.update(id, dto, parseIfMatch(ifMatch));
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Headers('if-match') ifMatch?: string) {
    return this.employees.remove(id, parseIfMatch(ifMatch));
  }
}
