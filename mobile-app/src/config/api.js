import { Platform } from 'react-native';

// Android emulators reach the host machine through 10.0.2.2.
export const API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
export const WS_BASE_URL = 'ws://localhost:3000';

export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  setup: {
    check: '/setup/check',
    create: '/setup/create',
    admin: '/setup/admin',
  },
  products: {
    list: '/products',
    create: '/products',
    update: (id) => `/products/${id}`,
    delete: (id) => `/products/${id}`,
    categories: '/products/categories',
  },
  sales: {
    list: '/sales',
    create: '/sales',
    update: (id) => `/sales/${id}`,
    delete: (id) => `/sales/${id}`,
    report: '/sales/report',
  },
  inventory: {
    list: '/inventory',
    create: '/inventory',
    update: (id) => `/inventory/${id}`,
    delete: (id) => `/inventory/${id}`,
    adjust: '/inventory/adjust',
  },
  customers: {
    list: '/customers',
    create: '/customers',
    update: (id) => `/customers/${id}`,
    delete: (id) => `/customers/${id}`,
    history: (id) => `/customers/${id}/history`,
  },
  stores: {
    list: '/stores',
    create: '/stores',
    update: (id) => `/stores/${id}`,
    delete: (id) => `/stores/${id}`,
  },
  users: {
    list: '/users',
    create: '/users',
    update: (id) => `/users/${id}`,
    delete: (id) => `/users/${id}`,
  },
  reports: {
    daily: '/reports/daily',
    monthly: '/reports/monthly',
    products: '/reports/products',
    customers: '/reports/customers',
  },
  sync: {
    status: '/sync/status',
    push: '/sync/push',
    pull: '/sync/pull',
    conflicts: '/sync/conflicts',
  },
  offline: {
    cache: '/offline/cache',
    clear: '/offline/clear',
  },
};