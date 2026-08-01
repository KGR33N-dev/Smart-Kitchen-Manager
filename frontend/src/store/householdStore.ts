/**
 * Household (family) store — the shared context for fridge/pantry/lists/notes.
 */
import { create } from 'zustand';
import { Household, householdsApi } from '../api/client';

interface HouseholdState {
  households: Household[];
  isLoading: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  create: (name: string) => Promise<Household>;
  join: (code: string) => Promise<Household>;
  switchTo: (id: number) => Promise<void>;

  active: () => Household | undefined;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  households: [],
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ households: await householdsApi.list() });
    } catch (e: any) {
      set({ error: e?.detail ?? 'Nie udało się pobrać gospodarstw' });
    } finally {
      set({ isLoading: false });
    }
  },

  create: async (name) => {
    const h = await householdsApi.create(name);
    await get().fetch();
    return h;
  },

  join: async (code) => {
    const h = await householdsApi.join(code);
    await get().fetch();
    return h;
  },

  switchTo: async (id) => {
    await householdsApi.switch(id);
    await get().fetch();
  },

  active: () => get().households.find(h => h.is_active),
}));
