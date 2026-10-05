import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, EmployeesModule],
})
export class AppModule {}
