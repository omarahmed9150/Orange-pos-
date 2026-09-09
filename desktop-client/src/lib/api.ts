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
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthSession();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
