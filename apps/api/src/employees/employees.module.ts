import { Module } from '@nestjs/common';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, IdempotencyService],
  exports: [IdempotencyService],
})
export class EmployeesModule {}
