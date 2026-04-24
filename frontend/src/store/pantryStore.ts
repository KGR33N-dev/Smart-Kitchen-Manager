/**
 * Zustand Pantry Store
 * Real-time fridge/pantry state management with optimistic updates.
 */
import { create } from 'zustand';
import { FoodItem, itemsApi, ItemStatus } from '../api/client';

interface PantryState {
  items: FoodItem[];
  expiringItems: FoodItem[];
  pendingVerification: FoodItem[];
  isLoading: boolean;
  error: string | null;

  // Stats
  totalItems: number;
  freshCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  zeroWasteScore: number;

  // Actions
  fetchItems: () => Promise<void>;
  fetchExpiring: (days?: number) => Promise<void>;
  fetchPendingVerification: () => Promise<void>;
  addItem: (item: FoodItem) => void;
  updateItem: (item: FoodItem) => void;
  removeItem: (id: number) => void;
  verifyItem: (id: number, confirmed: boolean) => void;
  computeStats: () => void;
}

const computeZeroWasteScore = (items: FoodItem[]): number => {
  if (items.length === 0) return 100;
  const fresh = items.filter(i => i.status === 'fresh').length;
  return Math.round((fresh / items.length) * 100);
};

export const usePantryStore = create<PantryState>((set, get) => ({
  items: [],
  expiringItems: [],
  pendingVerification: [],
  isLoading: false,
  error: null,
  totalItems: 0,
  freshCount: 0,
  expiringSoonCount: 0,
  expiredCount: 0,
  zeroWasteScore: 100,

  computeStats: () => {
    const { items } = get();
    set({
      totalItems: items.length,
      freshCount: items.filter(i => i.status === 'fresh').length,
      expiringSoonCount: items.filter(i => i.status === 'expiring_soon').length,
      expiredCount: items.filter(i => i.status === 'expired').length,
      zeroWasteScore: computeZeroWasteScore(items),
    });
  },

  fetchItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await itemsApi.list();
      set({ items: res.data });
      get().computeStats();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchExpiring: async (days = 3) => {
    try {
      const res = await itemsApi.expiring(days);
      set({ expiringItems: res.data });
    } catch { }
  },

  fetchPendingVerification: async () => {
    try {
      const res = await itemsApi.pendingVerification();
      set({ pendingVerification: res.data });
    } catch { }
  },

  addItem: (item) => {
    set(state => ({ items: [item, ...state.items] }));
    get().computeStats();
  },

  updateItem: (item) => {
    set(state => ({
      items: state.items.map(i => (i.id === item.id ? item : i)),
      expiringItems: state.expiringItems.map(i => (i.id === item.id ? item : i)),
      pendingVerification: state.pendingVerification.filter(i => i.id !== item.id),
    }));
    get().computeStats();
  },

  removeItem: (id) => {
    set(state => ({
      items: state.items.filter(i => i.id !== id),
      expiringItems: state.expiringItems.filter(i => i.id !== id),
      pendingVerification: state.pendingVerification.filter(i => i.id !== id),
    }));
    get().computeStats();
  },

  verifyItem: (id, confirmed) => {
    set(state => ({
      pendingVerification: state.pendingVerification.filter(i => i.id !== id),
      items: state.items.map(i =>
        i.id === id
          ? { ...i, ai_verified: true, status: confirmed ? i.status : 'expired' as ItemStatus }
          : i,
      ),
    }));
    get().computeStats();
  },
}));
