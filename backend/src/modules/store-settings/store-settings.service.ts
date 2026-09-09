import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateStoreSettingsDto } from './dto/update-settings.dto';

const SINGLETON_ID = 'singleton';

function settingsId(storeId: string) {
  return storeId === 'default-store' ? SINGLETON_ID : `${storeId}:settings`;
}

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** يرجّع الإعدادات، وينشئ صف افتراضي عند أول استخدام إن لم يوجد */
  async get(storeId = 'default-store') {
    const existing = await this.prisma.storeSettings.findFirst({ where: { storeId } });
    if (existing) return existing;
    return this.prisma.storeSettings.create({ data: { id: settingsId(storeId), storeId } });
  }

  async update(dto: UpdateStoreSettingsDto, userId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: userId } });
    const storeId = actor?.storeId ?? 'default-store';
    await this.get(storeId); // يضمن وجود الصف أولاً
    const updated = await this.prisma.storeSettings.update({
      where: { id: settingsId(storeId) },
      data: dto,
    });
    await this.audit.log(userId, 'STORE_SETTINGS_UPDATED', 'StoreSettings', SINGLETON_ID, dto);
    return updated;
  }

  /** تحديث بيانات الترخيص فقط - داخلي، يُستخدم من LicenseModule حصراً وليس من واجهة الإعدادات العامة */
  async setLicense(storeId: string, licenseKey: string) {
    await this.get(storeId);
    return this.prisma.storeSettings.update({
      where: { id: settingsId(storeId) },
      data: { licenseKey, licenseActivatedAt: new Date() },
    });
  }

  async setTelegramChatId(storeId: string, telegramChatId: string | null) {
    await this.get(storeId);
    return this.prisma.storeSettings.update({
      where: { id: settingsId(storeId) },
      data: { telegramChatId },
    });
  }
}
