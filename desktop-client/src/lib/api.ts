import axios from 'axios';

const isFileProtocol = window.location.protocol === 'file:';
const apiBaseUrl = isFileProtocol
  ? 'http://127.0.0.1:3000/api'
  : (import.meta.env.VITE_API_URL || '/api');

export const api = axios.create({
  baseURL: apiBaseUrl,
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
      localStorage.removeItem('orange_token');
      localStorage.removeItem('orange_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
