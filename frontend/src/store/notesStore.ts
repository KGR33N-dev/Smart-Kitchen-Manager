/**
 * Notes store — OFFLINE-FIRST.
 *
 * The local device is the source of truth: create/edit/delete always work with
 * no network. State is persisted to AsyncStorage (namespaced per household) so
 * notes survive app restarts offline. When online, `sync()` pushes locally
 * changed ("dirty") notes and merges everyone else's using last-write-wins on
 * `client_updated_at`. Deletions are tombstones so they propagate too.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoteChange, notesApi } from '../api/client';

const STORAGE_KEY = 'sk_notes_v1';

export interface LocalNote {
  client_id: string;
  title: string;
  content: string;
  color: string | null;
  is_deleted: boolean;
  client_updated_at: string; // ISO, device clock
  dirty: boolean;            // pending push to server
}

type PersistShape = Record<string, { notes: LocalNote[]; lastSync: string | null }>;

interface NotesState {
  householdId: number | null;
  notes: LocalNote[];
  lastSync: string | null;
  syncing: boolean;
  online: boolean;

  setHousehold: (id: number | null) => Promise<void>;
  upsert: (note: { client_id?: string; title: string; content: string; color?: string | null }) => Promise<void>;
  remove: (clientId: string) => Promise<void>;
  sync: () => Promise<void>;
  visible: () => LocalNote[];
}

const nowIso = () => new Date().toISOString();
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function readAll(): Promise<PersistShape> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistShape) : {};
  } catch { return {}; }
}

async function writeSlice(householdId: number, notes: LocalNote[], lastSync: string | null) {
  try {
    const all = await readAll();
    all[String(householdId)] = { notes, lastSync };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* best-effort */ }
}

export const useNotesStore = create<NotesState>((set, get) => ({
  householdId: null,
  notes: [],
  lastSync: null,
  syncing: false,
  online: true,

  setHousehold: async (id) => {
    if (id == null) { set({ householdId: null, notes: [], lastSync: null }); return; }
    const all = await readAll();
    const slice = all[String(id)] ?? { notes: [], lastSync: null };
    set({ householdId: id, notes: slice.notes, lastSync: slice.lastSync });
    // Try to sync in the background; ignore failures (offline).
    get().sync().catch(() => { /* offline */ });
  },

  upsert: async ({ client_id, title, content, color = null }) => {
    const { householdId, notes } = get();
    const id = client_id ?? newId();
    const existingIdx = notes.findIndex(n => n.client_id === id);
    const updated: LocalNote = {
      client_id: id, title, content, color, is_deleted: false,
      client_updated_at: nowIso(), dirty: true,
    };
    const next = existingIdx >= 0
      ? notes.map(n => (n.client_id === id ? updated : n))
      : [updated, ...notes];
    set({ notes: next });
    if (householdId != null) await writeSlice(householdId, next, get().lastSync);
    get().sync().catch(() => { /* offline */ });
  },

  remove: async (clientId) => {
    const { householdId, notes } = get();
    const next = notes.map(n =>
      n.client_id === clientId
        ? { ...n, is_deleted: true, client_updated_at: nowIso(), dirty: true }
        : n,
    );
    set({ notes: next });
    if (householdId != null) await writeSlice(householdId, next, get().lastSync);
    get().sync().catch(() => { /* offline */ });
  },

  sync: async () => {
    const { householdId, notes, lastSync, syncing } = get();
    if (householdId == null || syncing) return;
    set({ syncing: true });
    try {
      const changes: NoteChange[] = notes
        .filter(n => n.dirty)
        .map(n => ({
          client_id: n.client_id,
          title: n.title,
          content: n.content,
          color: n.color,
          is_deleted: n.is_deleted,
          client_updated_at: n.client_updated_at,
        }));

      const res = await notesApi.sync({ since: lastSync, changes });

      // Merge server notes with last-write-wins on client_updated_at.
      const byId = new Map(get().notes.map(n => [n.client_id, n]));
      for (const sn of res.notes) {
        const local = byId.get(sn.client_id);
        if (!local || sn.client_updated_at >= local.client_updated_at) {
          byId.set(sn.client_id, {
            client_id: sn.client_id,
            title: sn.title,
            content: sn.content,
            color: sn.color,
            is_deleted: sn.is_deleted,
            client_updated_at: sn.client_updated_at,
            dirty: false,
          });
        }
      }
      const merged = Array.from(byId.values());
      set({ notes: merged, lastSync: res.server_time, online: true });
      await writeSlice(householdId, merged, res.server_time);
    } catch {
      set({ online: false }); // stay offline; dirty notes retry next time
    } finally {
      set({ syncing: false });
    }
  },

  visible: () =>
    get().notes
      .filter(n => !n.is_deleted)
      .sort((a, b) => (a.client_updated_at < b.client_updated_at ? 1 : -1)),
}));
