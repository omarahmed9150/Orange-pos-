import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../lib/api';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  storeId: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  locked: boolean;
  lock: () => void;
  unlockWithPin: (pin: string) => Promise<void>;
  quickSwitchUser: (username: string, pin: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('orange_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [locked, setLocked] = useState(false);

  async function login(username: string, password: string) {
    localStorage.clear();
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('orange_token', data.accessToken);
    localStorage.setItem('orange_user', JSON.stringify(data.user));
    localStorage.setItem('orange_store_id', data.user.storeId);
    setUser(data.user);
    setLocked(false);
  }

  function logout() {
    localStorage.clear();
    setUser(null);
    setLocked(false);
  }

  function hasRole(...roles: UserRole[]) {
    return !!user && roles.includes(user.role);
  }

  /** يقفل الشاشة فوراً دون تسجيل خروج - الجلسة والتوكن يبقيان صالحين */
  function lock() {
    setLocked(true);
  }

  /** إلغاء القفل لنفس المستخدم عبر PIN - لا يُغيّر الجلسة */
  async function unlockWithPin(pin: string) {
    await api.post('/auth/verify-pin', { pin });
    setLocked(false);
  }

  /** تبديل سريع لمستخدم آخر (كاشير مختلف) عبر اسم المستخدم + PIN بدل تسجيل خروج/دخول كامل */
  async function quickSwitchUser(username: string, pin: string) {
    const { data } = await api.post('/auth/quick-switch', { username, pin });
    localStorage.setItem('orange_token', data.accessToken);
    localStorage.setItem('orange_user', JSON.stringify(data.user));
    localStorage.setItem('orange_store_id', data.user.storeId);
    setUser(data.user);
    setLocked(false);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, locked, lock, unlockWithPin, quickSwitchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
