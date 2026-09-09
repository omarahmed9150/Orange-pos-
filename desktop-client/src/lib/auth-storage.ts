import type { AuthUser } from '../context/AuthContext';

const USER_KEY = 'orange_user';
const TOKEN_KEY = 'orange_token';
const STORE_KEY = 'orange_store_id';

export function validStoreId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value !== 'null' && value !== 'undefined';
}

export function readTokenStoreId(token: string): unknown {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('التوكن المخزن ليس JWT صالحاً');
  }

  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
  return (JSON.parse(atob(paddedPayload)) as { storeId?: unknown }).storeId;
}

export function getStoredTokenStoreId(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const storeId = readTokenStoreId(token);
    return validStoreId(storeId) ? storeId : null;
  } catch {
    return null;
  }
}

export function clearStorageIfTokenHasInvalidStore(): void {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  try {
    if (!validStoreId(readTokenStoreId(token))) {
      localStorage.clear();
    }
  } catch {
    localStorage.clear();
  }
}

export function saveAuthSession(token: string, user: AuthUser) {
  if (!validStoreId(user.storeId)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STORE_KEY);
    throw new Error('معرف المتجر غير صالح');
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(STORE_KEY, user.storeId);
}

export function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    if (!validStoreId(user.storeId)) {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(STORE_KEY);
      return null;
    }
    return user;
  } catch {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(STORE_KEY);
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(STORE_KEY);
}
