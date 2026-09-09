import { useEffect, useState, type MouseEvent } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../context/I18nContext';

interface StoreSettingsData {
  storeName: string;
  currency: string;
  taxEnabled: boolean;
  taxRate: number;
  defaultLanguage: string;
  dbBackupDir: string | null;
  secondaryCurrencyEnabled: boolean;
  secondaryCurrency: string | null;
  exchangeRate: number | null;
}

export function Settings() {
  const { t } = useI18n();
  const [link, setLink] = useState<string | null>(null);
  const [botConfigured, setBotConfigured] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettingsData | null>(null);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [dbBackupStatus, setDbBackupStatus] = useState<{ configured: boolean; lastBackupAt: string | null; backupsCount: number } | null>(null);
  const [dbBackupMessage, setDbBackupMessage] = useState('');
  const [pinCurrentPassword, setPinCurrentPassword] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<{ isLicensed: boolean; activated: boolean; message: string; activatedAt: string | null } | null>(null);
  const [emailBackupConfigured, setEmailBackupConfigured] = useState(false);
  const [emailBackupEmail, setEmailBackupEmail] = useState('');
  const [emailBackupLoading, setEmailBackupLoading] = useState(false);
  const [emailBackupMessage, setEmailBackupMessage] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramStatus, setTelegramStatus] = useState('');

  useEffect(() => {
    api.get('/store-settings').then(({ data }) => setStoreSettings(data));
    loadDbBackupStatus();
    api.get('/license/status').then(({ data }) => setLicenseStatus(data));
    api.get('/backup/email/status').then(({ data }) => setEmailBackupConfigured(data.configured)).catch(() => setEmailBackupConfigured(false));
  }, []);

  async function loadDbBackupStatus() {
    try {
      const { data } = await api.get('/backup/database/status');
      setDbBackupStatus(data);
    } catch {
      // يتطلب صلاحية إدارية - يُتجاهل بصمت لباقي الأدوار
    }
  }

  async function runDbBackupNow() {
    setDbBackupMessage('');
    try {
      const { data } = await api.post('/backup/database/run-now');
      setDbBackupMessage(data.message);
      loadDbBackupStatus();
    } catch (err: any) {
      setDbBackupMessage(err?.response?.data?.message || 'تعذر تنفيذ النسخة الاحتياطية');
    }
  }

  async function setPin() {
    setPinMessage('');
    try {
      await api.post('/auth/set-pin', { currentPassword: pinCurrentPassword, pin: pinValue });
      setPinMessage('تم تعيين PIN بنجاح ✅');
      setPinCurrentPassword('');
      setPinValue('');
    } catch (err: any) {
      setPinMessage(err?.response?.data?.message || 'تعذر تعيين PIN');
    }
  }

  async function saveStoreSettings() {
    if (!storeSettings) return;
    setSettingsMessage('');
    try {
      const { data } = await api.patch('/store-settings', { ...storeSettings, telegramBotToken, telegramChatId });
      setStoreSettings(data);
      setSettingsMessage('تم حفظ الإعدادات ✅');
    } catch (err: any) {
      setSettingsMessage(err?.response?.data?.message || 'تعذر حفظ الإعدادات (يتطلب صلاحية إدارية)');
    }
  }

  async function generateLink(e: MouseEvent<HTMLButtonElement>) {
    e?.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { data } = await api.post('/telegram/link-token');
      setBotConfigured(data.botConfigured);
      setLink(data.link);
       window.open(data.link, '_blank', 'noopener,noreferrer');
      setMessage('تم توليد رابط ربط Telegram بنجاح ✅');
    } catch {
      setMessage('تعذر توليد رابط الربط');
    } finally {
      setLoading(false);
    }
  }

  async function unlink() {
    await api.delete('/telegram/link');
    setLink(null);
    setMessage('تم إلغاء الربط');
  }

  async function sendEmailBackup() {
    setEmailBackupMessage('');
    if (!emailBackupEmail.trim()) {
      setEmailBackupMessage('أدخل عنوان البريد الإلكتروني');
      return;
    }

    setEmailBackupLoading(true);
    try {
      const { data } = await api.post('/backup/email/send', { email: emailBackupEmail });
      setEmailBackupMessage(data.message);
      setEmailBackupEmail('');
    } catch (err: any) {
      setEmailBackupMessage(err?.response?.data?.message || 'تعذر إرسال النسخة الاحتياطية');
    } finally {
      setEmailBackupLoading(false);
    }
  }

  async function downloadExcelBackup() {
    setEmailBackupMessage('');
    try {
      const response = await api.get('/backup/email/download', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `orange_backup_${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setEmailBackupMessage('تم تنزيل النسخة الاحتياطية Excel ✅');
    } catch (err: any) {
      setEmailBackupMessage(err?.response?.data?.message || 'تعذر تنزيل النسخة الاحتياطية');
    }
  }

  async function testBackupNow() {
    setMessage('');
    const { data } = await api.post('/backup/run-now');
    setMessage(data.message);
  }

  async function verifyTelegramToken() {
    setTelegramStatus('');
    try {
      const { data } = await api.post('/telegram/verify-token', { token: telegramBotToken });
      setTelegramStatus(data.connected ? `متصل ✓${data.username ? ` (@${data.username})` : ''}` : `غير متصل ✕: ${data.message}`);
    } catch (err: any) {
      setTelegramStatus(err?.response?.data?.message || 'تعذر التحقق من Telegram');
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t('settings')}</h1>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <h2 className="font-bold">💱 العملة والضريبة واللغة</h2>
        {settingsMessage && <p className="text-sm text-orange-dark">{settingsMessage}</p>}

        {storeSettings && (
          <>
            <div>
              <label className="block text-sm mb-1">اسم المحل</label>
              <input
                value={storeSettings.storeName}
                onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">العملة</label>
                <input
                  value={storeSettings.currency}
                  onChange={(e) => setStoreSettings({ ...storeSettings, currency: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">لغة النظام</label>
                <input value="العربية" disabled className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-500" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={storeSettings.taxEnabled}
                onChange={(e) => setStoreSettings({ ...storeSettings, taxEnabled: e.target.checked })}
              />
              تفعيل الضريبة على الفواتير
            </label>

            {storeSettings.taxEnabled && (
              <div>
                <label className="block text-sm mb-1">نسبة الضريبة %</label>
                <input
                  type="number"
                  value={storeSettings.taxRate}
                  onChange={(e) => setStoreSettings({ ...storeSettings, taxRate: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={storeSettings.secondaryCurrencyEnabled}
                onChange={(e) => setStoreSettings({ ...storeSettings, secondaryCurrencyEnabled: e.target.checked })}
              />
              تفعيل عملة ثانوية (مثال: الدولار) بجانب العملة الأساسية
            </label>

            {storeSettings.secondaryCurrencyEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">رمز العملة الثانوية</label>
                  <input
                    value={storeSettings.secondaryCurrency || ''}
                    onChange={(e) => setStoreSettings({ ...storeSettings, secondaryCurrency: e.target.value })}
                    placeholder="USD"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">سعر الصرف (1 {storeSettings.secondaryCurrency || 'وحدة'} = ؟ {storeSettings.currency})</label>
                  <input
                    type="number"
                    value={storeSettings.exchangeRate ?? ''}
                    onChange={(e) => setStoreSettings({ ...storeSettings, exchangeRate: Number(e.target.value) })}
                    placeholder="1310"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm mb-1">مجلد النسخ الاحتياطي المحلي لقاعدة البيانات</label>
              <input
                value={storeSettings.dbBackupDir || ''}
                onChange={(e) => setStoreSettings({ ...storeSettings, dbBackupDir: e.target.value })}
                placeholder="مثال: D:\ORANGE-Backups أو مسار مجلد مزامنة"
                className="w-full border rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-400 mt-1">يُنسخ ملف قاعدة البيانات كاملاً لهذا المجلد تلقائياً كل 6 ساعات.</p>
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="font-semibold text-sm">إعدادات Telegram للنسخ الاحتياطي</p>
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="Telegram Bot Token"
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Telegram Chat ID"
                className="w-full border rounded-lg px-3 py-2"
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={verifyTelegramToken} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">
                  التحقق من الاتصال
                </button>
                {telegramStatus && <span className="text-sm">{telegramStatus}</span>}
              </div>
            </div>

            <button onClick={saveStoreSettings} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
              حفظ إعدادات المحل
            </button>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-3">
        <h2 className="font-bold">💾 النسخ الاحتياطي المحلي لقاعدة البيانات</h2>
        <p className="text-sm text-gray-500">
          نسخة كاملة من ملف قاعدة البيانات (وليس فقط الفواتير) — احفظها على قرص خارجي أو مجلد مزامنة لحمايتها من فقدان الجهاز.
        </p>

        {dbBackupStatus && (
          <div className="text-sm space-y-1">
            <p>عدد النسخ المحفوظة: <span className="font-semibold">{dbBackupStatus.backupsCount}</span></p>
            <p>
              آخر نسخة:{' '}
              <span className="font-semibold">
                {dbBackupStatus.lastBackupAt ? new Date(dbBackupStatus.lastBackupAt).toLocaleString('ar-EG') : 'لا توجد نسخة بعد'}
              </span>
            </p>
            {!dbBackupStatus.configured && (
              <p className="text-amber-600">⚠️ لم يتم تحديد مجلد النسخ الاحتياطي بعد — حدّده أعلاه ثم احفظ.</p>
            )}
          </div>
        )}

        {dbBackupMessage && <p className="text-sm text-orange-dark">{dbBackupMessage}</p>}

        <button onClick={runDbBackupNow} className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-semibold">
          💾 نسخ احتياطي الآن
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-3">
        <h2 className="font-bold">🔒 قفل الشاشة السريع (PIN)</h2>
        <p className="text-sm text-gray-500">
          عيّن PIN من 4 إلى 6 أرقام لقفل الشاشة أو تبديل الكاشير بسرعة على نفس الجهاز دون تسجيل خروج كامل.
        </p>

        {pinMessage && <p className="text-sm text-orange-dark">{pinMessage}</p>}

        <div>
          <label className="block text-sm mb-1">كلمة السر الحالية (للتأكيد)</label>
          <input
            type="password"
            value={pinCurrentPassword}
            onChange={(e) => setPinCurrentPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">PIN الجديد (4-6 أرقام)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinValue}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <button onClick={setPin} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
          حفظ PIN
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-3">
        <h2 className="font-bold">📧 النسخ الاحتياطي عبر البريد الإلكتروني</h2>
        <p className="text-sm text-gray-500">
          أرسل نسخة احتياطية منظمة وشاملة من جميع بيانات النظام (المنتجات والفواتير والعملاء وغيرها) إلى بريدك الإلكتروني كملف Excel.
        </p>

        {!emailBackupConfigured ? (
          <>
            <p className="text-sm text-amber-600">⚠️ لم يتم تفعيل خادم البريد (SMTP) أو فشل التحقق منه.</p>
            {emailBackupMessage && <p className="text-sm text-orange-dark">{emailBackupMessage}</p>}
            <button onClick={downloadExcelBackup} className="bg-emerald-600 text-white rounded-lg px-4 py-2 font-semibold">
              ⬇️ تنزيل النسخة الاحتياطية Excel
            </button>
          </>
        ) : (
          <>
            {emailBackupMessage && <p className="text-sm text-orange-dark">{emailBackupMessage}</p>}

            <div>
              <label className="block text-sm mb-1">عنوان البريد الإلكتروني</label>
              <input
                type="email"
                value={emailBackupEmail}
                onChange={(e) => setEmailBackupEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <button 
              onClick={sendEmailBackup} 
              disabled={emailBackupLoading || !emailBackupEmail.trim()}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
            >
              {emailBackupLoading ? 'جاري الإرسال...' : '📧 إرسال النسخة الاحتياطية'}
            </button>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <h2 className="font-bold">🔗 ربط حساب تليغرام</h2>
        <p className="text-sm text-gray-500">
          اربط حسابك لتصلك نسخة احتياطية خاصة بفواتيرك ومصاريفك تلقائياً كل يوم الساعة 00:00،
          إلى محادثتك الخاصة فقط (لا يشاركها أي مستخدم آخر).
        </p>

        {message && <p className="text-sm text-orange-dark">{message}</p>}

        {!link ? (
          <button type="button" onClick={generateLink} disabled={loading} className="bg-orange text-white rounded-lg px-4 py-2 font-semibold">
            توليد رابط الربط
          </button>
        ) : botConfigured ? (
          <div className="space-y-2">
            <a href={link} target="_blank" rel="noreferrer" className="block text-center bg-blue-500 text-white rounded-lg py-2 font-semibold">
              فتح Telegram للربط ↗
            </a>
            <button onClick={unlink} className="w-full bg-gray-100 rounded-lg py-2 text-sm">
              إلغاء الربط الحالي
            </button>
          </div>
        ) : null}

        <div className="border-t pt-4">
          <button onClick={testBackupNow} className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-semibold">
            📦 إرسال نسخة احتياطية الآن (اختبار)
          </button>
        </div>
      </div>

      {licenseStatus && (
        <div className="bg-white rounded-2xl shadow p-6 space-y-1">
          <h2 className="font-bold">🔑 حالة الترخيص</h2>
          {licenseStatus.isLicensed ? (
            <p className="text-sm text-emerald-600">
              مفعل ✅ {licenseStatus.activatedAt && `منذ ${new Date(licenseStatus.activatedAt).toLocaleDateString('ar-EG')}`}
            </p>
          ) : (
            <p className="text-sm text-red-600">{licenseStatus.message || 'غير مفعل'}</p>
          )}
        </div>
      )}
    </div>
  );
}
