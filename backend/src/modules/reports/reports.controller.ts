import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@Controller('reports')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('financial-summary')
  @ApiOperation({ summary: 'Revenue, COGS, Gross Profit, Expenses, Net Profit' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  financialSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.financialSummary(from, to);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'المنتجات الأكثر مبيعاً' })
  topProducts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.topProducts(from, to);
  }

  @Get('slow-products')
  @ApiOperation({ summary: 'المنتجات الراكدة' })
  slowProducts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.slowMovingProducts(from, to);
  }

  @Get('employee-performance')
  @ApiOperation({ summary: 'أداء الموظفين' })
  employeePerformance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.employeePerformance(from, to);
  }

  @Get('sales-trend')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'اتجاه المبيعات اليومي لآخر N يوم - للرسم البياني بلوحة التحكم (متاح لكل الأدوار)' })
  @ApiQuery({ name: 'days', required: false })
  salesTrend(@Query('days') days?: string) {
    const parsed = days === undefined ? 7 : Number(days);
    return this.reportsService.salesTrend(parsed);
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'تصدير تقرير شامل بصيغة Excel' })
  async exportExcel(@Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const filePath = await this.reportsService.exportToExcel(from, to);
    res.download(filePath, 'ORANGE_Report.xlsx', (err) => {
      if (!err) fs.unlink(filePath, () => {});
    });
  }
}
