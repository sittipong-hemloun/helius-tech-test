import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module.js';
import { InternalReportsController } from './internal-reports.controller.js';
import { ReportMaintenanceService } from './report-maintenance.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [EmployeesModule],
  controllers: [ReportsController, InternalReportsController],
  providers: [ReportsService, ReportMaintenanceService],
  exports: [ReportsService, ReportMaintenanceService],
})
export class ReportsModule {}
