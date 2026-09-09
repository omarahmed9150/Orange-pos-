import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
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

      const botUsername = process.env.TELEGRAM_BOT_NAME
        || process.env.TELEGRAM_BOT_USERNAME
        || 'YourBotName';
      const link = `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(token)}`;

      return { token, link };
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
    const payload = await response.json() as { ok?: boolean; result?: { username?: string } };
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
}