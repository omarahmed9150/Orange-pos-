import { BadRequestException, Injectable } from '@nestjs/common';
import { RefundStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { assertStoreId } from '../../common/security/store-scope';

interface DateRange {
  from?: Date;
  to?: Date;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string): DateRange {
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if ((parsedFrom && isNaN(parsedFrom.getTime())) || (parsedTo && isNaN(parsedTo.getTime()))) {
      throw new BadRequestException('نطاق التاريخ غير صالح');
    }
    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      throw new BadRequestException('تاريخ البداية يجب أن يسبق تاريخ النهاية');
    }
    return {
      from: parsedFrom,
      to: parsedTo,
    };
  }

  /** فصل مالي دقيق: Revenue, COGS, Gross Profit, Expenses, Net Profit */
  async financialSummary(from?: string, to?: string, storeId?: string) {
    assertStoreId(storeId);
    const { from: gte, to: lte } = this.range(from, to);

    const sales = await this.prisma.sale.findMany({
      where: { storeId, createdAt: { gte, lte } },
      include: { items: { include: { variant: true } } },
    });

    const expenses = await this.prisma.expense.findMany({ where: { storeId, createdAt: { gte, lte } } });

    let revenue = 0;
    let cogs = 0;

    for (const sale of sales) {
      const refundedRevenue = sale.items.reduce((sum, item) => sum + item.refundedQty * item.price, 0);
      revenue += Math.max(0, sale.totalAmount - refundedRevenue);
      for (const item of sale.items) {
        const soldQty = item.quantity - item.refundedQty;
        cogs += soldQty * (item.unitCostAtSale || item.variant.costPrice);
      }
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - totalExpenses;

    return {
      revenue: round(revenue),
      cogs: round(cogs),
      grossProfit: round(grossProfit),
      expenses: round(totalExpenses),
      netProfit: round(netProfit),
      salesCount: sales.filter((s) => s.refundStatus !== RefundStatus.FULL).length,
    };
  }

  /** المنتجات الأكثر مبيعاً (حسب الكمية المباعة الصافية) */
  async topProducts(from?: string, to?: string, limit = 10, storeId?: string) {
    assertStoreId(storeId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('حد التقرير يجب أن يكون بين 1 و100');
    }
    const { from: gte, to: lte } = this.range(from, to);
    const items = await this.prisma.saleItem.findMany({
      where: { storeId, sale: { storeId, createdAt: { gte, lte } } },
      include: { variant: { include: { product: true } } },
    });

    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of items) {
      const netQty = item.quantity - item.refundedQty;
      if (netQty <= 0) continue;
      const key = item.variantId;
      const label = `${item.variant.product.name}${item.variant.size || item.variant.color ? ` (${item.variant.size ?? 'N/A'}/${item.variant.color ?? 'N/A'})` : ''}`;
      const existing = map.get(key) ?? { name: label, qty: 0, revenue: 0 };
      existing.qty += netQty;
      existing.revenue += netQty * item.price;
      map.set(key, existing);
    }

    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
  }

  /** الأصناف الراكدة: أصناف لم تُبع إطلاقاً خلال الفترة رغم وجود مخزون */
  async slowMovingProducts(from?: string, to?: string, storeId?: string) {
    assertStoreId(storeId);
    const { from: gte, to: lte } = this.range(from, to);

    const soldVariantIds = new Set(
      (
        await this.prisma.saleItem.findMany({
          where: { storeId, sale: { storeId, createdAt: { gte, lte } } },
          select: { variantId: true },
        })
      ).map((i) => i.variantId),
    );

    const allVariants = await this.prisma.variant.findMany({
      where: { storeId, stockQuantity: { gt: 0 } },
      include: { product: true },
    });

    return allVariants
      .filter((v) => !soldVariantIds.has(v.id))
      .map((v) => ({ name: `${v.product.name}${v.size || v.color ? ` (${v.size ?? 'N/A'}/${v.color ?? 'N/A'})` : ''}`, stockQuantity: v.stockQuantity }));
  }

  /** أداء الموظفين: عدد الفواتير وإجمالي المبيعات لكل موظف */
  async employeePerformance(from?: string, to?: string, storeId?: string) {
    assertStoreId(storeId);
    const { from: gte, to: lte } = this.range(from, to);

    const sales = await this.prisma.sale.findMany({
      where: { storeId, createdAt: { gte, lte }, refundStatus: { not: RefundStatus.FULL } },
      include: { user: { select: { id: true, fullName: true, username: true } } },
    });

    const map = new Map<string, { name: string; invoiceCount: number; totalSales: number }>();
    for (const sale of sales) {
      const existing = map.get(sale.userId) ?? { name: sale.user.fullName, invoiceCount: 0, totalSales: 0 };
      existing.invoiceCount += 1;
      existing.totalSales += sale.totalAmount;
      map.set(sale.userId, existing);
    }

    return [...map.values()].sort((a, b) => b.totalSales - a.totalSales);
  }

  /** اتجاه المبيعات اليومي لآخر N يوم (كل الورديات وكل المستخدمين) - لرسم بياني بلوحة التحكم */
  async salesTrend(days = 7, storeId?: string) {
    assertStoreId(storeId);
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      throw new BadRequestException('عدد الأيام يجب أن يكون بين 1 و366');
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const sales = await this.prisma.sale.findMany({
      where: { storeId, createdAt: { gte: start }, refundStatus: { not: RefundStatus.FULL } },
      select: { totalAmount: true, createdAt: true },
    });

    const buckets: { date: string; total: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets.push({ date: d.toISOString().slice(0, 10), total: 0 });
    }

    for (const sale of sales) {
      const key = sale.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.find((b) => b.date === key);
      if (bucket) bucket.total += sale.totalAmount;
    }

    return buckets.map((b) => ({ ...b, total: round(b.total) }));
  }

  /** يبني ملف Excel كامل (ملخص مالي + الأكثر مبيعاً + الراكد + أداء الموظفين) ويرجّع مسار الملف المؤقت */
  async exportToExcel(from?: string, to?: string, storeId?: string) {
    assertStoreId(storeId);
    const [summary, top, slow, employees] = await Promise.all([
      this.financialSummary(from, to, storeId),
      this.topProducts(from, to, 20, storeId),
      this.slowMovingProducts(from, to, storeId),
      this.employeePerformance(from, to, storeId),
    ]);

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('الملخص المالي');
    summarySheet.addRows([
      ['الإيرادات (Revenue)', summary.revenue],
      ['تكلفة البضاعة المباعة (COGS)', summary.cogs],
      ['إجمالي الربح (Gross Profit)', summary.grossProfit],
      ['المصاريف (Expenses)', summary.expenses],
      ['صافي الربح (Net Profit)', summary.netProfit],
      ['عدد الفواتير', summary.salesCount],
    ]);

    const topSheet = workbook.addWorksheet('الأكثر مبيعاً');
    topSheet.columns = [
      { header: 'الصنف', key: 'name', width: 30 },
      { header: 'الكمية المباعة', key: 'qty', width: 15 },
      { header: 'الإيراد', key: 'revenue', width: 15 },
    ];
    topSheet.addRows(top);

    const slowSheet = workbook.addWorksheet('الأصناف الراكدة');
    slowSheet.columns = [
      { header: 'الصنف', key: 'name', width: 30 },
      { header: 'المخزون المتوفر', key: 'stockQuantity', width: 15 },
    ];
    slowSheet.addRows(slow);

    const empSheet = workbook.addWorksheet('أداء الموظفين');
    empSheet.columns = [
      { header: 'الموظف', key: 'name', width: 25 },
      { header: 'عدد الفواتير', key: 'invoiceCount', width: 15 },
      { header: 'إجمالي المبيعات', key: 'totalSales', width: 18 },
    ];
    empSheet.addRows(employees);

    const filePath = path.join(os.tmpdir(), `ORANGE_Report_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
