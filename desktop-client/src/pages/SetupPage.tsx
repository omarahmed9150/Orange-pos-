import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../lib/api';

interface SetupPageProps {
  onSetupComplete: () => void;
}

export const SetupPage: React.FC<SetupPageProps> = ({ onSetupComplete }) => {
  const [username, setUsername] = useState('');
  const [storeName, setStoreName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !storeName.trim() || !password) {
      setError('يرجى إدخال اسم المتجر واسم المستخدم وكلمة المرور');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    if (password.length < 4) {
      setError('كلمة المرور قصيرة جداً (على الأقل 4 أحرف)');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/setup-admin', {
        username: username.trim(),
        storeName: storeName.trim(),
        password,
      });

      if (data.success) {
        alert('تم إنشاء حساب المسؤول بنجاح! يمكنك الآن تسجيل الدخول.');
        onSetupComplete();
      } else {
        setError(data.message || data.error || 'حدث خطأ أثناء إعداد الحساب');
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء إعداد الحساب';
      setError(`تعذر إنشاء الحساب: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>مرحباً بك في ORANGE POS</h2>
          <p style={styles.subtitle}>
            هذه أول مرة تشغّل فيها النظام. يرجى إنشاء حساب المسؤول الرئيسي (Super Admin) للبدء:
          </p>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>اسم المتجر:</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="مثال: متجر ORANGE"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>اسم المستخدم:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: admin"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>كلمة المرور:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>تأكيد كلمة المرور:</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'جاري إنشاء الحساب...' : 'حفظ وإكمال الإعداد'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f4f6f8',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    direction: 'rtl',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    color: '#ff6600',
    margin: '0 0 0.5rem 0',
    fontSize: '22px',
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#6c757d',
    fontSize: '14px',
    margin: 0,
    lineHeight: '1.5',
  },
  errorBox: {
    backgroundColor: '#fff3f3',
    color: '#d9534f',
    border: '1px solid #f5c6cb',
    padding: '0.75rem',
    borderRadius: '6px',
    marginBottom: '1rem',
    fontSize: '14px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputGroup: {
    marginBottom: '1.2rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.4rem',
    color: '#333333',
    fontSize: '14px',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '6px',
    border: '1px solid #cccccc',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  button: {
    backgroundColor: '#ff6600',
    color: '#ffffff',
    border: 'none',
    padding: '0.85rem',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
};

export default SetupPage;