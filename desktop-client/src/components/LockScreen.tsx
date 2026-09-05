import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LockScreen() {
  const { user, unlockWithPin, quickSwitchUser, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [switchMode, setSwitchMode] = useState(false);
  const [switchUsername, setSwitchUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function pressDigit(d: string) {
    setError('');
    setPin((prev) => (prev.length < 6 ? prev + d : prev));
  }

  function clearPin() {
    setPin('');
  }

  async function submit() {
    if (!pin) return;
    setLoading(true);
    setError('');
    try {
      if (switchMode) {
        if (!switchUsername.trim()) { setError('أدخل اسم المستخدم أولاً'); setLoading(false); return; }
        await quickSwitchUser(switchUsername.trim(), pin);
      } else {
        await unlockWithPin(pin);
      }
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setError('محاولات كثيرة متتالية - انتظر دقيقة ثم أعد المحاولة');
      } else {
        setError(err?.response?.data?.message || 'PIN غير صحيح');
      }
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-orange">ORANGE</h1>
          <p className="text-sm text-gray-500 mt-1">
            {switchMode ? 'تبديل المستخدم' : `الشاشة مقفلة - ${user?.fullName}`}
          </p>
        </div>

        {switchMode && (
          <input
            value={switchUsername}
            onChange={(e) => setSwitchUsername(e.target.value)}
            placeholder="اسم المستخدم"
            className="w-full border rounded-lg px-3 py-2 text-center"
          />
        )}

        <div className="text-center text-2xl font-mono tracking-widest border rounded-lg py-2 bg-gray-50">
          {pin.replace(/./g, '●') || <span className="text-gray-300">— — — —</span>}
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => pressDigit(d)} className="bg-gray-100 hover:bg-orange-light rounded-lg py-3 text-lg font-bold">
              {d}
            </button>
          ))}
          <button onClick={clearPin} className="bg-gray-100 rounded-lg py-3 text-sm">مسح</button>
          <button onClick={() => pressDigit('0')} className="bg-gray-100 hover:bg-orange-light rounded-lg py-3 text-lg font-bold">0</button>
          <button onClick={() => setPin((p) => p.slice(0, -1))} className="bg-gray-100 rounded-lg py-3 text-sm">⌫</button>
        </div>

        <button
          onClick={submit}
          disabled={loading || !pin}
          className="w-full bg-orange text-white rounded-lg py-2.5 font-semibold disabled:opacity-40"
        >
          {loading ? '...' : switchMode ? 'دخول' : 'إلغاء القفل'}
        </button>

        <div className="flex justify-between text-xs text-gray-500 pt-2 border-t">
          <button onClick={() => { setSwitchMode(!switchMode); setPin(''); setError(''); }} className="hover:text-orange">
            {switchMode ? 'رجوع لنفس الحساب' : '🔄 تبديل مستخدم'}
          </button>
          <button onClick={logout} className="hover:text-red-600">تسجيل خروج كامل</button>
        </div>
      </div>
    </div>
  );
}
