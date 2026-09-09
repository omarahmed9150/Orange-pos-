import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import TelegramBot = require('node-telegram-bot-api');
import { PrismaService } from '../../prisma/prisma.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeSettings: StoreSettingsService,
  ) {}

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN غير مضبوط - ميزة تليغرام معطّلة.');
      return;
    }

    try {
      if (!this.bot) {
        this.bot = new TelegramBot(token, { polling: true });
      }

      // معالجة أخطاء الـ Polling لمنع توقف الخدمة على Vercel
      this.bot.on('polling_error', (error) => {
        this.logger.error(`Telegram Polling Error: ${error.message}`);
      });

      this.bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
        const chatId = msg.chat.id.toString();
        const linkToken = match?.[1]?.trim();

        if (!linkToken) {
          await this.bot!.sendMessage(chatId, 'مرحباً بك في بوت ORANGE. يرجى استخدام رابط الربط من داخل التطبيق.');
          return;
        }

        const user = await this.prisma.user.findUnique({ where: { telegramLinkToken: linkToken } });
        if (!user) {
          await this.bot!.sendMessage(chatId, 'رابط الربط غير صالح أو منتهي الصلاحية.');
          return;
        }

        await this.storeSettings.setTelegramChatId(user.storeId, chatId);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { telegramLinkToken: null },
        });

        await this.bot!.sendMessage(
          chatId,
          `✅ تم ربط حسابك بنجاح، ${user.fullName}.\nستصلك نسخة احتياطية بفواتيرك ومصاريفك تلقائياً كل يوم الساعة 00:00.`,
        );
      });

      this.logger.log('بوت تليغرام يعمل الآن.');
    } catch (error: any) {
      this.logger.error(`فشل إعداد بوت تليغرام: ${error?.message}`);
    }
  }

  /** يولّد توكن ربط مؤقت ورابط Deep Link خاص بالمستخدم */
  async generateLinkToken(userId: string) {
    const token = crypto.randomBytes(16).toString('hex');
    await this.prisma.user.update({ where: { id: userId }, data: { telegramLinkToken: token } });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Orange_2bot';
    const link = `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(token)}`;

    return { token, link };
  }

  async unlink(userId: string, storeId: string) {
    await this.storeSettings.setTelegramChatId(storeId, null);
    await this.prisma.user.update({ where: { id: userId }, data: { telegramChatId: null } });
  }

  /** التحقق من تفعيل التليجرام عبر متغير البيئة أو الكائن */
  isConfigured(): boolean {
    return !!process.env.TELEGRAM_BOT_TOKEN || !!this.bot;
  }

  async verifyToken(token: string) {
    if (!token?.trim()) return { connected: false, message: 'توكن Telegram مطلوب' };
    try {
      const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token.trim())}/getMe`);
      const payload = (await response.json()) as { ok?: boolean; result?: { username?: string } };
      if (!response.ok || !payload.ok) {
        return { connected: false, message: 'توكن Telegram غير صالح' };
      }
      return { connected: true, username: payload.result?.username ?? null, message: 'متصل ✓' };
    } catch {
      return { connected: false, message: 'تعذر الاتصال بخوادم Telegram' };
    }
  }

  /** إرسال ملف (Excel/PDF) إلى محادثة المستخدم الخاصة */
  async sendDocumentToUser(chatId: string, filePath: string, caption: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token && !this.bot) return;

    const botInstance = this.bot || new TelegramBot(token!, { polling: false });
    await botInstance.sendDocument(chatId, filePath, { caption });
  }
}