import { useEffect, useState } from 'react';

/** بانر يظهر فقط بعد اكتمال تنزيل تحديث جديد بالخلفية - يطلب موافقة صريحة قبل إعادة التشغيل */
export function UpdateBanner() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onUpdateDownloaded) return;
    api.onUpdateDownloaded((info: { version: string }) => setNewVersion(info.version));
  }, []);

  if (!newVersion) return null;

  function restartNow() {
    setRestarting(true);
    (window as any).electronAPI?.restartAndInstallUpdate();
  }

  return (
    <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between text-sm">
      <span>🔄 تحديث جديد جاهز (الإصدار {newVersion}) - سيُطبَّق عند إعادة تشغيل البرنامج.</span>
      <button
        onClick={restartNow}
        disabled={restarting}
        className="bg-white text-emerald-700 rounded-lg px-3 py-1 font-semibold disabled:opacity-50"
      >
        {restarting ? 'جاري إعادة التشغيل...' : 'تحديث الآن'}
      </button>
    </div>
  );
}
