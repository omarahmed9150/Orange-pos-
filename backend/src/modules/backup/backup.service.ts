import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /** مهمة مجدولة يومياً الساعة 00:00 بالضبط - نسخة منفصلة لكل مستخدم مرتبط بتليغرام */
  @Cron('0 0 * * *')
  async runDailyBackup() {
    if (!this.telegram.isConfigured()) {
      this.logger.warn('تخطي النسخ الاحتياطي: بوت تليغرام غير مضبوط.');
      return;
    }

    const stores = await this.prisma.storeSettings.findMany({
      where: { telegramChatId: { not: null } },
    });

    for (const store of stores) {
      try {
        const owner = await this.prisma.user.findFirst({ where: { storeId: store.storeId, isActive: true }, orderBy: { createdAt: 'asc' } });
        if (owner) await this.backupForUser(owner.id, store.telegramChatId!, owner.fullName, store.storeId);
      } catch (err) {
        this.logger.error(`فشل النسخ الاحتياطي للمتجر ${store.storeId}: ${err}`);
      }
    }
  }

  /** يبني نسخة اليوم لمستخدم واحد ويرسلها فقط إلى محادثته الخاصة (خصوصية كاملة) */
  async backupForUser(userId: string, chatId: string, fullName: string, storeId: string) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const [sales, expenses, stockMovements] = await Promise.all([
      this.prisma.sale.findMany({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { items: { include: { variant: { include: { product: true } } } } },
      }),
      this.prisma.expense.findMany({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
      }),
      this.prisma.stockMovement.findMany({
        where: { storeId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { variant: { include: { product: true } } },
      }),
    ]);

    const filePath = await this.buildWorkbook(fullName, storeId, sales, expenses, stockMovements);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');

    await this.telegram.sendDocumentToUser(
      chatId,
      filePath,
      `📦 تقرير ORANGE_${dateStr}\nالمبيعات: ${sales.length} | المصاريف: ${expenses.length} | حركات المخزون: ${stockMovements.length}`,
    );

    fs.unlinkSync(filePath);
  }

  private async buildWorkbook(fullName: string, storeId: string, sales: any[], expenses: any[], stockMovements: any[]) {
    const workbook = new ExcelJS.Workbook();

    const salesSheet = workbook.addWorksheet('المبيعات');
    salesSheet.columns = [
      { header: 'رقم الفاتورة', key: 'id', width: 20 },
      { header: 'الوقت', key: 'time', width: 20 },
      { header: 'الإجمالي', key: 'total', width: 12 },
      { header: 'طريقة الدفع', key: 'payment', width: 14 },
      { header: 'حالة الاسترجاع', key: 'refund', width: 16 },
    ];
    for (const s of sales) {
      salesSheet.addRow({
        id: s.id,
        time: new Date(s.createdAt).toLocaleString('ar-EG'),
        total: s.totalAmount,
        payment: s.paymentMethod,
        refund: s.refundStatus,
      });
    }

    const expensesSheet = workbook.addWorksheet('المصاريف');
    expensesSheet.columns = [
      { header: 'البند', key: 'title', width: 25 },
      { header: 'المبلغ', key: 'amount', width: 12 },
      { header: 'الوقت', key: 'time', width: 20 },
    ];
    for (const e of expenses) {
      expensesSheet.addRow({ title: e.title, amount: e.amount, time: new Date(e.createdAt).toLocaleString('ar-EG') });
    }

    const movementsSheet = workbook.addWorksheet('حركة المخزون');
    movementsSheet.columns = [
      { header: 'الصنف', key: 'product', width: 28 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'النوع', key: 'type', width: 22 },
      { header: 'الكمية', key: 'quantity', width: 12 },
      { header: 'السبب', key: 'reason', width: 30 },
      { header: 'الوقت', key: 'time', width: 20 },
    ];
    for (const movement of stockMovements) {
      movementsSheet.addRow({
        product: movement.variant?.product?.name || 'غير معروف',
        sku: movement.variant?.sku || '',
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason || '',
        time: new Date(movement.createdAt).toLocaleString('ar-EG'),
      });
    }

    const summarySheet = workbook.addWorksheet('الملخص');
    const totalSales = sales.reduce((s, x) => s + x.totalAmount, 0);
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
    summarySheet.addRows([
      ['الموظف', fullName],
      ['المتجر', storeId],
      ['التاريخ', new Date().toLocaleDateString('ar-EG')],
      ['إجمالي المبيعات', totalSales],
      ['إجمالي المصاريف', totalExpenses],
      ['عدد حركات المخزون', stockMovements.length],
      ['صافي اليوم', totalSales - totalExpenses],
    ]);

    const fileName = `Backup_ORANGE_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${Date.now()}.xlsx`;
    const filePath = path.join(os.tmpdir(), fileName);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }
}
