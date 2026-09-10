import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateStoreSettingsDto } from './dto/update-settings.dto';
import { assertStoreId } from '../../common/security/store-scope';

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getPublicSettings() {
    return {
      storeName: 'ORANGE POS',
      defaultLanguage: 'ar',
      currency: 'IQD',
    };
  }

  /**
   * يرجّع إعدادات متجر واحد فقط (storeId فريد unique)، وينشئ صف خاص به عند أول استخدام إن لم يوجد.
   * لا يوجد أي صف "singleton" مشترك بعد الآن - كل متجر معزول تماماً بصف مستقل خاص به.
   */
  async get(storeId: string) {
    assertStoreId(storeId);
    const existing = await this.prisma.storeSettings.findUnique({ where: { storeId } });
    if (existing) return existing;
    return this.prisma.storeSettings.create({ data: { storeId } });
  }

  async update(dto: UpdateStoreSettingsDto, userId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: userId } });
    const storeId = actor?.storeId;
    assertStoreId(storeId);

    await this.get(storeId); // يضمن وجود صف الإعدادات الخاص بهذا المتجر أولاً
    const updated = await this.prisma.storeSettings.update({
      where: { storeId },
      data: dto,
    });
    await this.audit.log(userId, 'STORE_SETTINGS_UPDATED', 'StoreSettings', updated.id, dto);
    return updated;
  }

  /** تحديث بيانات الترخيص فقط - داخلي، يُستخدم من LicenseModule حصراً وليس من واجهة الإعدادات العامة */
  async setLicense(storeId: string, licenseKey: string) {
    assertStoreId(storeId);
    await this.get(storeId);
    return this.prisma.storeSettings.update({
      where: { storeId },
      data: { licenseKey, licenseActivatedAt: new Date() },
    });
  }

  async setTelegramChatId(storeId: string, telegramChatId: string | null) {
    assertStoreId(storeId);
    await this.get(storeId);
    return this.prisma.storeSettings.update({
      where: { storeId },
      data: { telegramChatId },
    });
  }
}