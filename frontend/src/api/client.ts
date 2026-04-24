// Lightweight auth client — no axios dependency (avoids import.meta issues)
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lokalny adres IP zamiast localhost dla poprawnej komunikacji w Expo Go:
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.178:8000';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  is_premium: boolean;
  scan_count_month: number;
}

// ── Token storage (web: AsyncStorage, native: AsyncStorage) ─────────────
let _accessToken: string | null = null;

async function saveToken(t: string) {
  _accessToken = t;
  try { await AsyncStorage.setItem('access_token', t); } catch { }
}
async function loadToken(): Promise<string | null> {
  if (_accessToken) return _accessToken;
  try { _accessToken = await AsyncStorage.getItem('access_token'); } catch { }
  return _accessToken;
}
async function clearToken() {
  _accessToken = null;
  try { await AsyncStorage.removeItem('access_token'); } catch { }
}

// ── Core fetch helper ───────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await loadToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, detail: body?.detail ?? res.statusText };
  }
  return res.json() as Promise<T>;
}

// ── Public API ──────────────────────────────────────────────────────────────
export const authApi = {
  /** Login with email + password, persist token */
  async login(email: string, password: string): Promise<UserOut> {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { status: res.status, detail: err?.detail ?? 'Invalid credentials' };
    }
    const tokens: TokenPair = await res.json();
    await saveToken(tokens.access_token);
    return apiFetch<UserOut>('/api/v1/auth/me');
  },

  /** Register new account, then auto-login */
  async register(email: string, password: string, full_name: string): Promise<UserOut> {
    await apiFetch<UserOut>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    });
    return authApi.login(email, password);
  },

  /** Load currently stored token + fetch /me */
  async loadMe(): Promise<UserOut | null> {
    const token = await loadToken();
    if (!token) return null;
    try {
      return await apiFetch<UserOut>('/api/v1/auth/me');
    } catch {
      await clearToken();
      return null;
    }
  },

  async logout() { await clearToken(); },
};

/** Thin food-items GET — used by screens when backend is available */
export const itemsApi = {
  async list() {
    return apiFetch<any[]>('/api/v1/items/');
  },
};
