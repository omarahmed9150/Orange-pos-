import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import TelegramBot = require('node-telegram-bot-api');
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN غير مضبوط - ميزة تليغرام معطّلة.');
      return;
    }

    // Polling محلي (لا يحتاج سيرفر عام/Webhook) - مناسب لتطبيق سطح مكتب يعمل محلياً
    this.bot = new TelegramBot(token, { polling: true });

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

      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId, telegramLinkToken: null },
      });

      await this.bot!.sendMessage(
        chatId,
        `✅ تم ربط حسابك بنجاح، ${user.fullName}.\nستصلك نسخة احتياطية بفواتيرك ومصاريفك تلقائياً كل يوم الساعة 00:00.`,
      );
    });

    this.logger.log('بوت تليغرام يعمل الآن (Polling).');
  }

  /** يولّد توكن ربط مؤقت ورابط Deep Link خاص بالمستخدم */
  async generateLinkToken(userId: string) {
    const token = crypto.randomBytes(16).toString('hex');
    await this.prisma.user.update({ where: { id: userId }, data: { telegramLinkToken: token } });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    const link = botUsername ? `tg://resolve?domain=${encodeURIComponent(botUsername)}&start=${encodeURIComponent(token)}` : null;

    return { token, link };
  }

  async unlink(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { telegramChatId: null } });
  }

  isConfigured() {
    return !!this.bot;
  }

  async verifyToken(token: string) {
    if (!token?.trim()) return { connected: false, message: 'توكن Telegram مطلوب' };
    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token.trim())}/getMe`);
    const payload = await response.json() as { ok?: boolean; result?: { username?: string } };
    if (!response.ok || !payload.ok) {
      return { connected: false, message: 'توكن Telegram غير صالح' };
    }
    return { connected: true, username: payload.result?.username ?? null, message: 'متصل ✓' };
  }

  /** إرسال ملف (Excel/PDF) إلى محادثة المستخدم الخاصة فقط - لا يشارك بيانات أي مستخدم آخر */
  async sendDocumentToUser(chatId: string, filePath: string, caption: string) {
    if (!this.bot) return;
    await this.bot.sendDocument(chatId, filePath, { caption });
  }
}
