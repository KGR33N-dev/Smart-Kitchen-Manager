/**
 * Zustand Auth Store — thin wrapper over the fetch API client.
 * Token persistence lives inside `api/client.ts` (AsyncStorage); this store
 * just tracks the current user and exposes auth actions to the UI.
 */
import { create } from 'zustand';
import { authApi, UserOut } from '../api/client';

interface AuthState {
  user: UserOut | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredUser: () => Promise<void>;
  setUser: (user: UserOut | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  loadStoredUser: async () => {
    set({ isLoading: true });
    const user = await authApi.loadMe();
    set({ user, isLoading: false });
  },

  login: async (email, password) => {
    const user = await authApi.login(email, password);
    set({ user });
  },

  register: async (email, password, fullName) => {
    const user = await authApi.register(email, password, fullName);
    set({ user });
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));
