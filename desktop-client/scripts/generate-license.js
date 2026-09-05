/**
 * سكربت توليد رموز تفعيل - يُستخدم من طرف صاحب النظام فقط (خارج التطبيق).
 * الاستخدام: node scripts/generate-license.js [العدد]
 * مثال: node scripts/generate-license.js 5   -> يولّد 5 رموز
 */
const crypto = require('crypto');

const SECRET = 'ORANGE-POS-2026-SECRET-SALT'; // يجب أن يطابق نفس القيمة في electron/license.ts تماماً

function checksum(groups) {
  const hash = crypto.createHash('sha256').update(groups.join('-') + SECRET).digest('hex').toUpperCase();
  return hash.slice(0, 4);
}

function generateLicenseKey() {
  const randomGroup = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  const groups = [randomGroup(), randomGroup(), randomGroup()];
  return `ORANGE-${groups.join('-')}-${checksum(groups)}`;
}

const count = Number(process.argv[2]) || 1;
for (let i = 0; i < count; i++) {
  console.log(generateLicenseKey());
}
