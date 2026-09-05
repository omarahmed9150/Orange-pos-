import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setError('محاولات كثيرة متتالية - انتظر دقيقة ثم أعد المحاولة');
      } else {
        setError(err?.response?.data?.message || 'فشل تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-orange-light">
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-lg p-8 w-96 space-y-4">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-orange">ORANGE</h1>
          <p className="text-gray-500 text-sm">نظام إدارة نقاط البيع</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('username')}</label>
          <input
            className="w-full border rounded-lg px-3 py-2 focus:outline-orange"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('password')}</label>
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 focus:outline-orange"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange hover:bg-orange-dark text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {loading ? '...' : t('login')}
        </button>

        <p className="text-xs text-gray-400 text-center">
          الدخول حصرياً بحساب أنشأه مدير النظام
        </p>
      </form>
    </div>
  );
}
