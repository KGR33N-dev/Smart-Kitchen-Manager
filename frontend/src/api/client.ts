/**
 * Smart-Fridge API client.
 *
 * Single, dependency-light client built on fetch (no axios — avoids the
 * import.meta issues under Expo/Metro). All screens and stores use this module.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure via EXPO_PUBLIC_API_URL. Fallback is a LAN IP so a phone running
// Expo Go can reach the dev backend (localhost won't work from a device).
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.178:8000';

// ── Types (mirror the backend Pydantic schemas) ─────────────────────────────

export type ItemStatus = 'fresh' | 'expiring_soon' | 'expired' | 'pending_verification';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  subscription_tier: 'free' | 'premium';
  is_premium: boolean;
  scans_this_month: number;
  active_household_id: number | null;
  subscription_valid_until: string | null;
  created_at: string;
}

export type MemberRole = 'owner' | 'member';

export interface Household {
  id: number;
  name: string;
  join_code: string;
  is_personal: boolean;
  owner_id: number;
  created_at: string;
  role: MemberRole | null;
  is_active: boolean;
  member_count: number;
}

export interface HouseholdMember {
  user_id: number;
  email: string;
  full_name: string;
  role: MemberRole;
}

export interface ShoppingItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  is_checked: boolean;
  created_at: string;
}

export interface ShoppingList {
  id: number;
  name: string;
  is_archived: boolean;
  created_at: string;
  items: ShoppingItem[];
}

export type TaskPeriod = 'daily' | 'weekly' | 'monthly';

/** Server-shaped note/task (used during sync). */
export interface ServerNote {
  client_id: string;
  title: string;
  content: string;
  color: string | null;
  is_deleted: boolean;
  period: TaskPeriod;
  is_done: boolean;
  remind_at: string | null; // "HH:MM"
  client_updated_at: string;
  updated_at: string;
  author_id: number | null;
}

export interface NoteChange {
  client_id: string;
  title: string;
  content: string;
  color?: string | null;
  is_deleted: boolean;
  period: TaskPeriod;
  is_done: boolean;
  remind_at: string | null;
  client_updated_at: string;
}

export interface SyncResponse {
  server_time: string;
  notes: ServerNote[];
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface FoodItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  expiry_date: string | null;
  status: ItemStatus;
  ai_verified: boolean;
  ai_confidence: number | null;
  image_url: string | null;
  category: Category | null;
  created_at: string;
  updated_at: string;
}

export interface FoodItemCreate {
  name: string;
  quantity?: number;
  unit?: string;
  location?: string;
  expiry_date?: string | null;
  category_id?: number | null;
  image_url?: string | null;
}

export type FoodItemUpdate = Partial<
  Pick<FoodItem, 'name' | 'quantity' | 'unit' | 'location' | 'expiry_date' | 'status'>
> & { category_id?: number | null };

export interface ScanOut {
  id: number;
  scan_type: string;
  original_filename: string;
  parsed_items_count: number;
  task_id: string | null;
  task_status: string;
  created_at: string;
}

export interface ApiError {
  status: number;
  detail: string;
}

// ── Token storage ────────────────────────────────────────────────────────────

let _accessToken: string | null = null;

async function saveToken(t: string) {
  _accessToken = t;
  try { await AsyncStorage.setItem('access_token', t); } catch { /* noop */ }
}
async function loadToken(): Promise<string | null> {
  if (_accessToken) return _accessToken;
  try { _accessToken = await AsyncStorage.getItem('access_token'); } catch { /* noop */ }
  return _accessToken;
}
async function clearToken() {
  _accessToken = null;
  try { await AsyncStorage.removeItem('access_token'); } catch { /* noop */ }
}

// ── Core fetch helpers ───────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    throw { status: res.status, detail: (body as any)?.detail ?? res.statusText } as ApiError;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Multipart upload — deliberately does NOT set Content-Type (fetch adds boundary). */
async function uploadFile<T>(path: string, uri: string, field = 'file'): Promise<T> {
  const token = await loadToken();
  const form = new FormData();
  const name = uri.split('/').pop() ?? 'upload.jpg';
  const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';
  // React Native FormData file shape:
  form.append(field, { uri, name, type } as any);

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, detail: (body as any)?.detail ?? res.statusText } as ApiError;
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length
    ? '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  async login(email: string, password: string): Promise<UserOut> {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { status: res.status, detail: (err as any)?.detail ?? 'Invalid credentials' } as ApiError;
    }
    const tokens: TokenPair = await res.json();
    await saveToken(tokens.access_token);
    return apiFetch<UserOut>('/api/v1/auth/me');
  },

  async register(email: string, password: string, full_name: string): Promise<UserOut> {
    await apiFetch<UserOut>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    });
    return authApi.login(email, password);
  },

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

  me: () => apiFetch<UserOut>('/api/v1/auth/me'),

  async logout() { await clearToken(); },
};

// ── Food items ──────────────────────────────────────────────────────────────

export const itemsApi = {
  list: (filters: { location?: string; category_id?: number; status?: ItemStatus } = {}) =>
    apiFetch<FoodItem[]>(`/api/v1/items/${qs(filters)}`),

  get: (id: number) => apiFetch<FoodItem>(`/api/v1/items/${id}`),

  create: (payload: FoodItemCreate) =>
    apiFetch<FoodItem>('/api/v1/items/', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: number, payload: FoodItemUpdate) =>
    apiFetch<FoodItem>(`/api/v1/items/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  remove: (id: number) =>
    apiFetch<void>(`/api/v1/items/${id}`, { method: 'DELETE' }),

  expiring: (days = 3) =>
    apiFetch<FoodItem[]>(`/api/v1/items/expiring${qs({ days })}`),

  pendingVerification: () =>
    apiFetch<FoodItem[]>('/api/v1/items/pending-verification'),

  verify: (id: number, confirmed: boolean, ai_prediction = 'fresh', ai_confidence?: number) =>
    apiFetch<FoodItem>(`/api/v1/items/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ confirmed, ai_prediction, ai_confidence }),
    }),
};

// ── Categories ────────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () => apiFetch<Category[]>('/api/v1/categories/'),
};

// ── Uploads (receipt / camera) ────────────────────────────────────────────────

export const uploadApi = {
  receipt: (uri: string) => uploadFile<ScanOut>('/api/v1/upload/receipt', uri),
  camera: (uri: string, itemName = 'Unknown item') =>
    uploadFile<ScanOut>(`/api/v1/upload/camera${qs({ item_name: itemName })}`, uri),
  pollStatus: (taskId: string) =>
    apiFetch<{ task_id: string; status: string; result: unknown }>(`/api/v1/upload/status/${taskId}`),
};

// ── Households (families / sharing) ──────────────────────────────────────────

export const householdsApi = {
  list: () => apiFetch<Household[]>('/api/v1/households/'),
  create: (name: string) =>
    apiFetch<Household>('/api/v1/households/', { method: 'POST', body: JSON.stringify({ name }) }),
  join: (code: string) =>
    apiFetch<Household>('/api/v1/households/join', { method: 'POST', body: JSON.stringify({ code }) }),
  members: (id: number) =>
    apiFetch<HouseholdMember[]>(`/api/v1/households/${id}/members`),
  switch: (id: number) =>
    apiFetch<Household>(`/api/v1/households/${id}/switch`, { method: 'POST' }),
  regenerateCode: (id: number) =>
    apiFetch<{ join_code: string }>(`/api/v1/households/${id}/regenerate-code`, { method: 'POST' }),
};

// ── Shopping lists ────────────────────────────────────────────────────────────

export const shoppingApi = {
  lists: () => apiFetch<ShoppingList[]>('/api/v1/shopping/lists'),
  createList: (name: string) =>
    apiFetch<ShoppingList>('/api/v1/shopping/lists', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteList: (id: number) =>
    apiFetch<void>(`/api/v1/shopping/lists/${id}`, { method: 'DELETE' }),
  addItem: (listId: number, item: { name: string; quantity?: number; unit?: string }) =>
    apiFetch<ShoppingItem>(`/api/v1/shopping/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  updateItem: (id: number, patch: Partial<Pick<ShoppingItem, 'name' | 'quantity' | 'unit' | 'is_checked'>>) =>
    apiFetch<ShoppingItem>(`/api/v1/shopping/items/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteItem: (id: number) =>
    apiFetch<void>(`/api/v1/shopping/items/${id}`, { method: 'DELETE' }),
};

// ── Notes (offline-first sync) ────────────────────────────────────────────────

export const notesApi = {
  sync: (payload: { since: string | null; changes: NoteChange[] }) =>
    apiFetch<SyncResponse>('/api/v1/notes/sync', { method: 'POST', body: JSON.stringify(payload) }),
  list: () => apiFetch<ServerNote[]>('/api/v1/notes/'),
};

// ── Payments ────────────────────────────────────────────────────────────────

export const paymentsApi = {
  checkout: () => apiFetch<{ checkout_url: string }>('/api/v1/payments/checkout', { method: 'POST' }),
  portal: () => apiFetch<{ portal_url: string }>('/api/v1/payments/portal', { method: 'POST' }),
};

// ── Local helpers (shared UI derivations) ─────────────────────────────────────

export const computeStats = (items: FoodItem[]) => ({
  total: items.length,
  fresh: items.filter(i => i.status === 'fresh').length,
  expiringSoon: items.filter(i => i.status === 'expiring_soon').length,
  expired: items.filter(i => i.status === 'expired').length,
  zeroWasteScore: items.length
    ? Math.round((items.filter(i => i.status !== 'expired').length / items.length) * 100)
    : 100,
});
