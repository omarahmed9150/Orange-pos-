import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * نظام ترخيص محلي بالكامل (بدون سيرفر خارجي أو إنترنت).
 * صيغة الرمز: ORANGE-XXXX-XXXX-XXXX-CCCC
 * المجموعة الأخيرة (CCCC) هي checksum مشتق من المجموعات الثلاث الأولى + سر ثابت (SECRET).
 * هذا يمنع تخمين رموز عشوائية، لكنه ليس تشفيراً عسكرياً - مناسب لحماية محل تجاري صغير
 * وليس لبيع تجاري واسع النطاق (لو أردت ذلك مستقبلاً يُستبدل بتحقق عبر سيرفر مركزي).
 */

const SECRET = 'ORANGE-POS-2026-SECRET-SALT'; // يجب تغييره قبل التوزيع الفعلي للبرنامج

function checksum(groups: string[]): string {
  const hash = crypto.createHash('sha256').update(groups.join('-') + SECRET).digest('hex').toUpperCase();
  return hash.slice(0, 4);
}

/** يولّد رمز ترخيص صالح - يُستخدم من طرف البائع فقط (سكربت منفصل)، وليس من داخل التطبيق */
export function generateLicenseKey(): string {
  const randomGroup = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const groups = [randomGroup(), randomGroup(), randomGroup()];
  return `ORANGE-${groups.join('-')}-${checksum(groups)}`;
}

export function isValidLicenseFormat(key: string): boolean {
  const parts = key.trim().toUpperCase().split('-');
  if (parts.length !== 5 || parts[0] !== 'ORANGE') return false;
  const [, g1, g2, g3, c] = parts;
  if (![g1, g2, g3].every((g) => /^[0-9A-F]{4}$/.test(g))) return false;
  return checksum([g1, g2, g3]) === c;
}

function licenseFilePath(): string {
  return path.join(app.getPath('userData'), 'license.json');
}

export function getLicenseStatus(): { activated: boolean; key?: string } {
  try {
    const raw = fs.readFileSync(licenseFilePath(), 'utf-8');
    const data = JSON.parse(raw);
    if (data?.key && isValidLicenseFormat(data.key)) {
      return { activated: true, key: data.key };
    }
    return { activated: false };
  } catch {
    return { activated: false };
  }
}

export function activateLicense(key: string): { success: boolean; message: string } {
  if (!isValidLicenseFormat(key)) {
    return { success: false, message: 'رمز التفعيل غير صحيح' };
  }
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(licenseFilePath(), JSON.stringify({ key: key.trim().toUpperCase(), activatedAt: new Date().toISOString() }));
  return { success: true, message: 'تم التفعيل بنجاح' };
}
