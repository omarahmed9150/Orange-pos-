import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateStoreSettingsDto } from './dto/update-settings.dto';

const SINGLETON_ID = 'singleton';

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** يرجّع الإعدادات، وينشئ صف افتراضي عند أول استخدام إن لم يوجد */
  async get(storeId = 'default-store') {
    const existing = await this.prisma.storeSettings.findFirst({ where: { id: SINGLETON_ID, storeId } });
    if (existing) return existing;
    return this.prisma.storeSettings.create({ data: { id: SINGLETON_ID, storeId } });
  }

  async update(dto: UpdateStoreSettingsDto, userId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: userId } });
    const storeId = actor?.storeId ?? 'default-store';
    await this.get(storeId); // يضمن وجود الصف أولاً
    const updated = await this.prisma.storeSettings.update({
      where: { id: SINGLETON_ID },
      data: dto,
    });
    await this.audit.log(userId, 'STORE_SETTINGS_UPDATED', 'StoreSettings', SINGLETON_ID, dto);
    return updated;
  }

  /** تحديث بيانات الترخيص فقط - داخلي، يُستخدم من LicenseModule حصراً وليس من واجهة الإعدادات العامة */
  async setLicense(licenseKey: string) {
    await this.get();
    return this.prisma.storeSettings.update({
      where: { id: SINGLETON_ID },
      data: { licenseKey, licenseActivatedAt: new Date() },
    });
  }
}
