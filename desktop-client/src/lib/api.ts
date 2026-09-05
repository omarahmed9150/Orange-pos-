import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
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
