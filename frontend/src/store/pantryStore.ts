/**
 * Zustand Pantry Store — backend-backed fridge/pantry state.
 * All reads/writes go through the fetch API client; the store keeps a local
 * cache and derived stats for the UI.
 */
import { create } from 'zustand';
import {
  FoodItem,
  FoodItemCreate,
  FoodItemUpdate,
  itemsApi,
} from '../api/client';

interface PantryState {
  items: FoodItem[];
  expiringItems: FoodItem[];
  pendingVerification: FoodItem[];
  isLoading: boolean;
  error: string | null;

  // Derived stats
  totalItems: number;
  freshCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  zeroWasteScore: number;

  // Reads
  fetchItems: () => Promise<void>;
  fetchExpiring: (days?: number) => Promise<void>;
  fetchPendingVerification: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // Writes
  createItem: (payload: FoodItemCreate) => Promise<FoodItem>;
  updateItem: (id: number, payload: FoodItemUpdate) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  verifyItem: (id: number, confirmed: boolean, aiConfidence?: number) => Promise<void>;

  computeStats: () => void;
}

const zeroWaste = (items: FoodItem[]): number => {
  if (items.length === 0) return 100;
  const notWasted = items.filter(i => i.status !== 'expired').length;
  return Math.round((notWasted / items.length) * 100);
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
      zeroWasteScore: zeroWaste(items),
    });
  },

  fetchItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await itemsApi.list();
      set({ items });
      get().computeStats();
    } catch (e: any) {
      set({ error: e?.detail ?? 'Nie udało się pobrać produktów' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchExpiring: async (days = 3) => {
    try {
      set({ expiringItems: await itemsApi.expiring(days) });
    } catch { /* non-critical */ }
  },

  fetchPendingVerification: async () => {
    try {
      set({ pendingVerification: await itemsApi.pendingVerification() });
    } catch { /* non-critical */ }
  },

  refreshAll: async () => {
    await Promise.all([
      get().fetchItems(),
      get().fetchExpiring(),
      get().fetchPendingVerification(),
    ]);
  },

  createItem: async (payload) => {
    const created = await itemsApi.create(payload);
    set(state => ({ items: [created, ...state.items] }));
    get().computeStats();
    return created;
  },

  updateItem: async (id, payload) => {
    const updated = await itemsApi.update(id, payload);
    set(state => ({
      items: state.items.map(i => (i.id === id ? updated : i)),
      expiringItems: state.expiringItems.map(i => (i.id === id ? updated : i)),
    }));
    get().computeStats();
  },

  removeItem: async (id) => {
    await itemsApi.remove(id);
    set(state => ({
      items: state.items.filter(i => i.id !== id),
      expiringItems: state.expiringItems.filter(i => i.id !== id),
      pendingVerification: state.pendingVerification.filter(i => i.id !== id),
    }));
    get().computeStats();
  },

  verifyItem: async (id, confirmed, aiConfidence) => {
    const updated = await itemsApi.verify(id, confirmed, 'fresh', aiConfidence);
    set(state => ({
      pendingVerification: state.pendingVerification.filter(i => i.id !== id),
      items: state.items.map(i => (i.id === id ? updated : i)),
    }));
    get().computeStats();
  },
}));
