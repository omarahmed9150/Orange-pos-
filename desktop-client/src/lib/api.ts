import axios from 'axios';
import { clearAuthSession } from './auth-storage';

export const API_BASE_URL = 'https://backend-nine-swart-94.vercel.app/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// إرفاق توكن الدخول تلقائياً بكل طلب
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('orange_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// عند انتهاء صلاحية الجلسة أو الحظر -> تسجيل خروج تلقائي
api.interceptors.response.use(
  (res) => {
    const renewedToken = res.headers['x-renewed-token'];
    if (typeof renewedToken === 'string' && renewedToken) {
      localStorage.setItem('orange_token', renewedToken);
    }
    return res;
  },
  (error) => {
    if (error?.response?.status === 401) {
      const isTelegramRequest = String(error?.config?.url || '').includes('/telegram');
      if (isTelegramRequest) {
        const message = 'حسابك غير مرتبط بمتجر، يرجى التواصل مع الدعم';
        window.dispatchEvent(new CustomEvent('api-error', { detail: { message } }));
        if (error.response) {
          error.response.data = { ...(error.response.data || {}), message };
        }
        return Promise.reject(error);
      }
      clearAuthSession();
      window.location.hash = '#/login';
    }
    return Promise.reject(error);
  },
);
