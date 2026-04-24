/**
 * Zustand Auth Store
 * Manages JWT tokens (persisted via expo-secure-store) and current user.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  is_premium: boolean;
  subscription_tier: 'free' | 'premium';
  scans_this_month: number;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredTokens: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
}

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  loadStoredTokens: async () => {
    try {
      const access = await SecureStore.getItemAsync(TOKEN_KEY);
      const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
      if (access) {
        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        set({ accessToken: access, refreshToken: refresh });
        // Fetch current user profile
        const res = await api.get('/api/v1/auth/me');
        set({ user: res.data });
      }
    } catch {
      // Token expired or invalid — clear
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const res = await api.post('/api/v1/auth/token', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token, refresh_token } = res.data;
    await SecureStore.setItemAsync(TOKEN_KEY, access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    const me = await api.get('/api/v1/auth/me');
    set({ accessToken: access_token, refreshToken: refresh_token, user: me.data });
  },

  register: async (email, password, fullName) => {
    await api.post('/api/v1/auth/register', { email, password, full_name: fullName });
    await get().login(email, password);
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, accessToken: null, refreshToken: null });
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;
    try {
      const res = await api.post(`/api/v1/auth/refresh?refresh_token=${refreshToken}`);
      const { access_token, refresh_token } = res.data;
      await SecureStore.setItemAsync(TOKEN_KEY, access_token);
      await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      set({ accessToken: access_token, refreshToken: refresh_token });
      return true;
    } catch {
      await get().logout();
      return false;
    }
  },
}));
