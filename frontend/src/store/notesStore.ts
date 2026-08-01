/**
 * Notes / tasks store — OFFLINE-FIRST.
 *
 * The local device is the source of truth: create/edit/check/delete always work
 * with no network. State is persisted to AsyncStorage (per household) so tasks
 * survive restarts offline. When online, `sync()` pushes locally changed
 * ("dirty") tasks and merges everyone else's with last-write-wins on
 * `client_updated_at`. Deletions are tombstones. Each task can carry a
 * `remind_at` time that schedules a repeating local notification by period.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoteChange, TaskPeriod, notesApi } from '../api/client';
import { cancelReminder, scheduleTaskReminder } from '../lib/notifications';

const STORAGE_KEY = 'sk_notes_v2';

export interface LocalNote {
  client_id: string;
  title: string;
  content: string;
  color: string | null;
  is_deleted: boolean;
  period: TaskPeriod;
  is_done: boolean;
  remind_at: string | null; // "HH:MM"
  client_updated_at: string;
  dirty: boolean;
  notificationId?: string | null; // local-only, never synced
}

type PersistShape = Record<string, { notes: LocalNote[]; lastSync: string | null }>;

interface NotesState {
  householdId: number | null;
  notes: LocalNote[];
  lastSync: string | null;
  syncing: boolean;
  online: boolean;

  setHousehold: (id: number | null) => Promise<void>;
  upsert: (note: {
    client_id?: string; title: string; content?: string;
    period: TaskPeriod; remind_at?: string | null; is_done?: boolean;
  }) => Promise<void>;
  toggleDone: (clientId: string) => Promise<void>;
  remove: (clientId: string) => Promise<void>;
  sync: () => Promise<void>;
  byPeriod: (period: TaskPeriod) => LocalNote[];
}

const nowIso = () => new Date().toISOString();
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const shouldNotify = (n: LocalNote) => !n.is_deleted && !n.is_done && !!n.remind_at;

/** Cancel a task's previous reminder and (re)schedule if it should notify. */
async function reconcileReminder(note: LocalNote): Promise<LocalNote> {
  await cancelReminder(note.notificationId);
  let notificationId: string | null = null;
  if (shouldNotify(note)) {
    notificationId = await scheduleTaskReminder(note.title, note.remind_at, note.period);
  }
  return { ...note, notificationId };
}

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
    get().sync().catch(() => { /* offline */ });
  },

  upsert: async ({ client_id, title, content = '', period, remind_at = null, is_done = false }) => {
    const { householdId, notes } = get();
    const id = client_id ?? newId();
    const prev = notes.find(n => n.client_id === id);
    let updated: LocalNote = {
      client_id: id, title, content, color: prev?.color ?? null, is_deleted: false,
      period, is_done, remind_at,
      client_updated_at: nowIso(), dirty: true,
      notificationId: prev?.notificationId ?? null,
    };
    updated = await reconcileReminder(updated);
    const next = prev
      ? notes.map(n => (n.client_id === id ? updated : n))
      : [updated, ...notes];
    set({ notes: next });
    if (householdId != null) await writeSlice(householdId, next, get().lastSync);
    get().sync().catch(() => { /* offline */ });
  },

  toggleDone: async (clientId) => {
    const { householdId, notes } = get();
    const prev = notes.find(n => n.client_id === clientId);
    if (!prev) return;
    let updated: LocalNote = {
      ...prev, is_done: !prev.is_done, client_updated_at: nowIso(), dirty: true,
    };
    updated = await reconcileReminder(updated); // cancel reminder once done
    const next = notes.map(n => (n.client_id === clientId ? updated : n));
    set({ notes: next });
    if (householdId != null) await writeSlice(householdId, next, get().lastSync);
    get().sync().catch(() => { /* offline */ });
  },

  remove: async (clientId) => {
    const { householdId, notes } = get();
    const prev = notes.find(n => n.client_id === clientId);
    await cancelReminder(prev?.notificationId);
    const next = notes.map(n =>
      n.client_id === clientId
        ? { ...n, is_deleted: true, notificationId: null, client_updated_at: nowIso(), dirty: true }
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
          period: n.period,
          is_done: n.is_done,
          remind_at: n.remind_at,
          client_updated_at: n.client_updated_at,
        }));

      const res = await notesApi.sync({ since: lastSync, changes });

      const byId = new Map(get().notes.map(n => [n.client_id, n]));
      for (const sn of res.notes) {
        const local = byId.get(sn.client_id);
        if (!local || sn.client_updated_at >= local.client_updated_at) {
          let merged: LocalNote = {
            client_id: sn.client_id,
            title: sn.title,
            content: sn.content,
            color: sn.color,
            is_deleted: sn.is_deleted,
            period: sn.period,
            is_done: sn.is_done,
            remind_at: sn.remind_at,
            client_updated_at: sn.client_updated_at,
            dirty: false,
            notificationId: local?.notificationId ?? null,
          };
          // Re-schedule/cancel the reminder if the incoming state differs.
          const relevantChanged =
            !local ||
            local.remind_at !== sn.remind_at ||
            local.period !== sn.period ||
            local.is_done !== sn.is_done ||
            local.is_deleted !== sn.is_deleted ||
            local.title !== sn.title;
          if (relevantChanged) merged = await reconcileReminder(merged);
          byId.set(sn.client_id, merged);
        }
      }
      const mergedNotes = Array.from(byId.values());
      set({ notes: mergedNotes, lastSync: res.server_time, online: true });
      await writeSlice(householdId, mergedNotes, res.server_time);
    } catch {
      set({ online: false });
    } finally {
      set({ syncing: false });
    }
  },

  byPeriod: (period) =>
    get().notes
      .filter(n => !n.is_deleted && n.period === period)
      .sort((a, b) => {
        // Undone first, then by reminder time, then most-recent.
        if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
        if (a.remind_at && b.remind_at && a.remind_at !== b.remind_at) return a.remind_at < b.remind_at ? -1 : 1;
        if (!!a.remind_at !== !!b.remind_at) return a.remind_at ? -1 : 1;
        return a.client_updated_at < b.client_updated_at ? 1 : -1;
      }),
}));
