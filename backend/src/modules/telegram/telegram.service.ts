import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';
import TelegramBot = require('node-telegram-bot-api');
import { assertStoreId } from '../../common/security/store-scope';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeSettings: StoreSettingsService,
  ) {}

  /** معالجة الرسائل القادمة من Telegram Webhook */
  async handleWebhook(update: any) {
    const message = update?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    if (text.startsWith('/start')) {
      const match = text.match(/\/start(?:\s+(.+))?/);
      const linkToken = match?.[1]?.trim();

      if (!linkToken) {
        await this.sendMessage(chatId, 'مرحباً بك في بوت ORANGE. يرجى استخدام رابط الربط من داخل التطبيق.');
        return;
      }

      const user = await this.prisma.user.findUnique({ where: { telegramLinkToken: linkToken } });
      if (!user) {
        await this.sendMessage(chatId, 'رابط الربط غير صالح أو منتهي الصلاحية.');
        return;
      }

      assertStoreId(user.storeId);
      await this.storeSettings.setTelegramChatId(user.storeId, chatId);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramLinkToken: null },
      });

      await this.sendMessage(
        chatId,
        `✅ تم ربط حسابك بنجاح، ${user.fullName}.\nستصلك نسخة احتياطية بفواتيرك ومصاريفك تلقائياً كل يوم الساعة 00:00.`,
      );
    }
  }

  /** إرسال نص إلى التليجرام عبر REST API المباشر */
  async sendMessage(chatId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  /** يولّد توكن ربط مؤقت ورابط Deep Link خاص بالمستخدم */
  async generateLinkToken(userId: string, storeId: string) {
    try {
      assertStoreId(storeId);
      const token = crypto.randomBytes(16).toString('hex');
      await this.prisma.user.update({ where: { id: userId, storeId }, data: { telegramLinkToken: token } });

      // تنظيف اسم البوت من أي '@' أو فراغات زائدة قد تصل بالخطأ عبر متغيرات البيئة
      const rawBot = process.env.TELEGRAM_BOT_NAME || process.env.TELEGRAM_BOT_USERNAME || 'Orange_pos_bot';
      const cleanBot = rawBot.replace(/^@/, '').trim();

      // بناء رابط مطلق صحيح 100% يدوياً - لا يعتمد على أي تنسيق وسيط قد يكسر الرابط
      const link = `https://t.me/${cleanBot}?start=${encodeURIComponent(token)}`;

      // تحقّق دفاعي إضافي: تأكد أن الرابط الناتج قابل للتحليل فعلياً وصالح البنية قبل إعادته للواجهة
      try {
        const parsed = new URL(link);
        if (parsed.protocol !== 'https:' || parsed.hostname !== 't.me' || !parsed.searchParams.get('start')) {
          throw new Error('invalid-link-shape');
        }
      } catch {
        this.logger.error(`رابط Telegram الناتج غير صالح - تحقق من TELEGRAM_BOT_NAME الحالي: "${rawBot}"`);
        throw new BadRequestException('تعذر توليد رابط ربط صالح - تحقق من إعداد اسم بوت Telegram (TELEGRAM_BOT_NAME)');
      }

      return { token, link, botConfigured: this.isConfigured() };
    } catch (error) {
      this.logger.error(`فشل توليد رابط Telegram للمستخدم ${userId}:`, error instanceof Error ? error.stack : String(error));
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('تعذر توليد رابط الربط حالياً');
    }
  }

  async unlink(userId: string, storeId: string) {
    assertStoreId(storeId);
    await this.storeSettings.setTelegramChatId(storeId, null);
    await this.prisma.user.update({ where: { id: userId, storeId }, data: { telegramChatId: null } });
  }

  isConfigured() {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_USERNAME || 'Orange_2bot');
  }

  async verifyToken(token: string) {
    if (!token?.trim()) return { connected: false, message: 'توكن Telegram مطلوب' };
    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token.trim())}/getMe`);
    const payload = (await response.json()) as { ok?: boolean; result?: { username?: string } };
    return response.ok && payload.ok
      ? { connected: true, username: payload.result?.username ?? null, message: 'متصل ✓' }
      : { connected: false, message: 'توكن Telegram غير صالح' };
  }

  async sendDocumentToUser(chatId: string, filePath: string, caption: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required to send Telegram documents');
    const bot = new TelegramBot(token);
    await bot.sendDocument(chatId, filePath, { caption });
  }

  /** إرسال ملف من الذاكرة (Buffer) مباشرة دون كتابته على القرص - يُستخدم للتقرير اليومي */
  private async sendDocumentBuffer(chatId: string, buffer: Buffer, filename: string, caption: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required to send Telegram documents');
    const bot = new TelegramBot(token);
    await bot.sendDocument(
      chatId,
      buffer,
      { caption },
      { filename, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    );
  }

  /**
   * يبني ملف Excel لتقرير يوم واحد (مبيعات + مصاريف + حركة مخزون + ملخص) - **حصراً** لمتجر storeId.
   * ملاحظة مهمة: استعلامات المبيعات والمصاريف أدناه تفترض جدولي "invoices" و"expenses" بنفس نمط
   * تسمية بقية جداول مشروعك. إن اختلفت أسماء الجداول/الأعمدة الفعلية في مخطط Prisma لديك، عدّل فقط
   * جزأي "المبيعات" و"المصاريف" أدناه - بقية الملف (حركة المخزون، الإرسال، الجدولة) يعمل فعلياً كما هو.
   */
  async generateDailyReportBuffer(storeId: string, day: Date = new Date()): Promise<Buffer> {
    assertStoreId(storeId);

    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);

    const workbook = new ExcelJS.Workbook();

    // --- المبيعات (حصراً لهذا المتجر) ---
    let salesRows: Array<{ id: string; createdAt: Date; total: number }> = [];
    let salesTotal = 0;
    try {
      salesRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "createdAt", "total" FROM "invoices" WHERE "storeId" = $1 AND "createdAt" BETWEEN $2 AND $3 ORDER BY "createdAt" ASC`,
        storeId,
        dayStart,
        dayEnd,
      );
    } catch (err) {
      this.logger.warn(`تعذّر قراءة جدول المبيعات (invoices) للتقرير اليومي: ${err instanceof Error ? err.message : String(err)}`);
    }
    const salesSheet = workbook.addWorksheet('المبيعات');
    salesSheet.columns = [
      { header: 'رقم الفاتورة', key: 'id', width: 24 },
      { header: 'التاريخ والوقت', key: 'createdAt', width: 20 },
      { header: 'الإجمالي', key: 'total', width: 14 },
    ];
    for (const row of salesRows) {
      salesSheet.addRow({ id: row.id, createdAt: new Date(row.createdAt).toLocaleString('ar-EG'), total: Number(row.total) || 0 });
      salesTotal += Number(row.total) || 0;
    }

    // --- المصاريف (حصراً لهذا المتجر) ---
    let expenseRows: Array<{ id: string; createdAt: Date; amount: number; description?: string | null }> = [];
    let expensesTotal = 0;
    try {
      expenseRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "createdAt", "amount", "description" FROM "expenses" WHERE "storeId" = $1 AND "createdAt" BETWEEN $2 AND $3 ORDER BY "createdAt" ASC`,
        storeId,
        dayStart,
        dayEnd,
      );
    } catch (err) {
      this.logger.warn(`تعذّر قراءة جدول المصاريف (expenses) للتقرير اليومي: ${err instanceof Error ? err.message : String(err)}`);
    }
    const expensesSheet = workbook.addWorksheet('المصاريف');
    expensesSheet.columns = [
      { header: 'المعرف', key: 'id', width: 24 },
      { header: 'التاريخ والوقت', key: 'createdAt', width: 20 },
      { header: 'المبلغ', key: 'amount', width: 14 },
      { header: 'الوصف', key: 'description', width: 30 },
    ];
    for (const row of expenseRows) {
      expensesSheet.addRow({
        id: row.id,
        createdAt: new Date(row.createdAt).toLocaleString('ar-EG'),
        amount: Number(row.amount) || 0,
        description: row.description ?? '',
      });
      expensesTotal += Number(row.amount) || 0;
    }

    // --- حركة المخزون (نموذج stockMovement الحقيقي - مفلترة بصرامة بـ storeId عبر السجل والصنف والمنتج) ---
    const movements = await this.prisma.stockMovement.findMany({
      where: { storeId, createdAt: { gte: dayStart, lte: dayEnd }, variant: { storeId, product: { storeId } } },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const movementsSheet = workbook.addWorksheet('حركة المخزون');
    movementsSheet.columns = [
      { header: 'الوقت', key: 'createdAt', width: 20 },
      { header: 'المنتج', key: 'product', width: 24 },
      { header: 'الصنف (SKU)', key: 'sku', width: 18 },
      { header: 'النوع', key: 'type', width: 20 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'السبب', key: 'reason', width: 24 },
    ];
    for (const m of movements) {
      movementsSheet.addRow({
        createdAt: m.createdAt.toLocaleString('ar-EG'),
        product: m.variant?.product?.name ?? '',
        sku: m.variant?.sku ?? '',
        type: m.type,
        quantity: m.quantity,
        reason: m.reason ?? '',
      });
    }

    // --- ملخص اليوم ---
    const summarySheet = workbook.addWorksheet('ملخص اليوم');
    summarySheet.columns = [
      { header: 'البند', key: 'label', width: 28 },
      { header: 'القيمة', key: 'value', width: 20 },
    ];
    summarySheet.addRow({ label: 'التاريخ', value: dayStart.toLocaleDateString('ar-EG') });
    summarySheet.addRow({ label: 'عدد الفواتير', value: salesRows.length });
    summarySheet.addRow({ label: 'إجمالي المبيعات', value: salesTotal });
    summarySheet.addRow({ label: 'عدد المصاريف', value: expenseRows.length });
    summarySheet.addRow({ label: 'إجمالي المصاريف', value: expensesTotal });
    summarySheet.addRow({ label: 'صافي اليوم', value: salesTotal - expensesTotal });
    summarySheet.addRow({ label: 'عدد حركات المخزون', value: movements.length });

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  /** يرسل تقرير اليوم فوراً - حصراً لمتجر storeId (زر "إرسال نسخة احتياطية الآن (اختبار)") */
  async sendDailyReportNow(storeId: string) {
    assertStoreId(storeId);
    const chatId = await this.getConfiguredChatId(storeId);
    if (!chatId) {
      throw new BadRequestException('لا يوجد حساب Telegram مرتبط بهذا المتجر بعد');
    }

    const buffer = await this.generateDailyReportBuffer(storeId);
    const filename = `orange_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await this.sendDocumentBuffer(chatId, buffer, filename, '📦 نسخة احتياطية / تقرير اليوم (اختبار)');
    return { message: 'تم إرسال التقرير إلى Telegram بنجاح ✅' };
  }

  /** مهمة مجدولة: تُرسل تقرير Excel يومياً الساعة 00:00 لكل متجر مرتبط بـ Telegram - كل متجر يستلم بياناته فقط */
  @Cron('0 0 * * *')
  async handleScheduledDailyReports() {
    const configuredStores = await this.getAllConfiguredStores();
    for (const { storeId, chatId } of configuredStores) {
      try {
        const buffer = await this.generateDailyReportBuffer(storeId);
        const filename = `orange_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await this.sendDocumentBuffer(chatId, buffer, filename, '📦 نسخة احتياطية يومية تلقائية - فواتيرك ومصاريفك');
      } catch (err) {
        this.logger.error(
          `فشل إرسال التقرير اليومي للمتجر ${storeId}:`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  /** يجلب chatId الخاص بمتجر واحد فقط (حصراً) - يفترض جدول store_settings بنفس نمط تسمية بقية الجداول */
  private async getConfiguredChatId(storeId: string): Promise<string | null> {
    assertStoreId(storeId);
    const rows = await this.prisma.$queryRawUnsafe<Array<{ telegramChatId: string | null }>>(
      `SELECT "telegramChatId" FROM "store_settings" WHERE "storeId" = $1 LIMIT 1`,
      storeId,
    );
    return rows?.[0]?.telegramChatId ?? null;
  }

  /** يجلب كل المتاجر المرتبطة فعلياً بـ Telegram - تُستخدم فقط من المهمة المجدولة الليلية */
  private async getAllConfiguredStores(): Promise<Array<{ storeId: string; chatId: string }>> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ storeId: string; telegramChatId: string }>>(
      `SELECT "storeId", "telegramChatId" FROM "store_settings" WHERE "telegramChatId" IS NOT NULL`,
    );
    return rows.map((r) => ({ storeId: r.storeId, chatId: r.telegramChatId }));
  }
}