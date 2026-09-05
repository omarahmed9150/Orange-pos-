import { ReactNode, useEffect, useState } from 'react';

/**
 * يمنع استخدام أي جزء من التطبيق قبل إدخال رمز تفعيل صحيح.
 * الفحص يتم عبر Electron IPC (محلي بالكامل، بلا إنترنت) عند كل تشغيل للبرنامج.
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'activated' | 'locked'>('checking');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const electronApi = (window as any).electronAPI;
    if (!electronApi?.checkLicense) {
      // بيئة تطوير بالمتصفح بلا Electron - تجاوز الفحص لتسهيل التطوير فقط
      setStatus('activated');
      return;
    }
    electronApi.checkLicense()
      .then((res: { activated: boolean }) => setStatus(res.activated ? 'activated' : 'locked'))
      .catch(() => {
        setError('تعذر التحقق من الترخيص المحلي');
        setStatus('locked');
      });
  }, []);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.activateLicense(key);
      if (res.success) {
        setStatus('activated');
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر تفعيل الترخيص');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'checking') {
    return <div className="h-screen flex items-center justify-center text-gray-400">جاري التحقق...</div>;
  }

  if (status === 'locked') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-96 space-y-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-orange">ORANGE</h1>
            <p className="text-gray-500 text-sm mt-1">أدخل رمز التفعيل لبدء استخدام النظام</p>
          </div>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="ORANGE-XXXX-XXXX-XXXX-XXXX"
            className="w-full border rounded-lg px-3 py-2 text-center font-mono tracking-wide"
            dir="ltr"
          />
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            onClick={submit}
            disabled={loading || !key.trim()}
            className="w-full bg-orange text-white rounded-lg py-2.5 font-semibold disabled:opacity-50"
          >
            {loading ? 'جاري التحقق...' : 'تفعيل'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            لا تملك رمز تفعيل؟ تواصل مع الجهة التي زوّدتك بالنظام.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
