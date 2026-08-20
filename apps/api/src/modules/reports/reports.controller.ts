import { Controller, Get, Query } from '@nestjs/common';
import { MonthlyReportDto } from './reports.dto.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('monthly') monthly(@Query() query: MonthlyReportDto) { return this.reports.monthly(query); }
}
