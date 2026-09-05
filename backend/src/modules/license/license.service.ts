import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { StoreSettingsService } from '../store-settings/store-settings.service';

// يجب أن يطابق نفس القيمة تماماً في desktop-client/electron/license.ts وscripts/generate-license.js
const SECRET = 'ORANGE-POS-2026-SECRET-SALT';

function checksum(groups: string[]): string {
  const hash = crypto.createHash('sha256').update(groups.join('-') + SECRET).digest('hex').toUpperCase();
  return hash.slice(0, 4);
}

function isValidLicenseFormat(key: string): boolean {
  const parts = key.trim().toUpperCase().split('-');
  if (parts.length !== 5 || parts[0] !== 'ORANGE') return false;
  const [, g1, g2, g3, c] = parts;
  if (![g1, g2, g3].every((g) => /^[0-9A-F]{4}$/.test(g))) return false;
  return checksum([g1, g2, g3]) === c;
}

@Injectable()
export class LicenseService {
  constructor(private readonly storeSettings: StoreSettingsService) {}

  /**
   * حالة الترخيص من قاعدة البيانات نفسها - طبقة تحقق مكمّلة لملف الترخيص المحلي بجهاز Electron
   * (أصعب على المستخدم تجاوزها بحذف ملف واحد، لأنها مرتبطة بنفس قاعدة بيانات العمل).
   */
  async getStatus() {
    const settings = await this.storeSettings.get();
    return {
      activated: !!settings.licenseKey && isValidLicenseFormat(settings.licenseKey),
      activatedAt: settings.licenseActivatedAt,
    };
  }

  async activate(licenseKey: string) {
    if (!isValidLicenseFormat(licenseKey)) {
      throw new BadRequestException('رمز التفعيل غير صحيح');
    }

    await this.storeSettings.setLicense(licenseKey.trim().toUpperCase());

    return { success: true, message: 'تم تفعيل الترخيص بنجاح' };
  }
}
