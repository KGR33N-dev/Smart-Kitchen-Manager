// ── Mock data — no backend needed ────────────────────────────────────────────
import { differenceInDays, addDays, subDays } from 'date-fns';

export type ItemStatus = 'fresh' | 'expiring_soon' | 'expired' | 'pending_verification';

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
  category: { id: number; name: string; icon: string } | null;
  image_url: string | null;
}

const now = new Date();

export const MOCK_ITEMS: FoodItem[] = [
  {
    id: 1, name: 'Mleko 3,2%', quantity: 1, unit: 'L', location: 'Lodówka',
    expiry_date: addDays(now, 2).toISOString(), status: 'expiring_soon',
    ai_verified: false, ai_confidence: 0.91, image_url: null,
    category: { id: 1, name: 'Dairy', icon: '🥛' },
  },
  {
    id: 2, name: 'Jogurt naturalny', quantity: 2, unit: 'szt.', location: 'Lodówka',
    expiry_date: addDays(now, 1).toISOString(), status: 'expiring_soon',
    ai_verified: false, ai_confidence: 0.87, image_url: null,
    category: { id: 1, name: 'Dairy', icon: '🥛' },
  },
  {
    id: 3, name: 'Ser żółty Gouda', quantity: 200, unit: 'g', location: 'Lodówka',
    expiry_date: addDays(now, 14).toISOString(), status: 'fresh',
    ai_verified: true, ai_confidence: 0.95, image_url: null,
    category: { id: 2, name: 'Dairy', icon: '🧀' },
  },
  {
    id: 4, name: 'Pomidory malinowe', quantity: 0.5, unit: 'kg', location: 'Lodówka',
    expiry_date: addDays(now, 3).toISOString(), status: 'expiring_soon',
    ai_verified: true, ai_confidence: 0.78, image_url: null,
    category: { id: 3, name: 'Vegetables', icon: '🍅' },
  },
  {
    id: 5, name: 'Jabłka Fuji', quantity: 6, unit: 'szt.', location: 'Spiżarnia',
    expiry_date: addDays(now, 10).toISOString(), status: 'fresh',
    ai_verified: true, ai_confidence: 0.99, image_url: null,
    category: { id: 4, name: 'Fruit', icon: '🍎' },
  },
  {
    id: 6, name: 'Kurczak filet', quantity: 400, unit: 'g', location: 'Zamrażarka',
    expiry_date: addDays(now, 30).toISOString(), status: 'fresh',
    ai_verified: true, ai_confidence: 0.93, image_url: null,
    category: { id: 5, name: 'Meat', icon: '🍗' },
  },
  {
    id: 7, name: 'Chleb pszenny', quantity: 1, unit: 'szt.', location: 'Blat',
    expiry_date: subDays(now, 1).toISOString(), status: 'expired',
    ai_verified: false, ai_confidence: 0.82, image_url: null,
    category: { id: 6, name: 'Bakery', icon: '🍞' },
  },
  {
    id: 8, name: 'Jajka M', quantity: 6, unit: 'szt.', location: 'Lodówka',
    expiry_date: addDays(now, 21).toISOString(), status: 'fresh',
    ai_verified: true, ai_confidence: 0.96, image_url: null,
    category: { id: 7, name: 'Other', icon: '🥚' },
  },
  {
    id: 9, name: 'Szpinak baby', quantity: 150, unit: 'g', location: 'Lodówka',
    expiry_date: addDays(now, 0).toISOString(), status: 'expiring_soon',
    ai_verified: false, ai_confidence: 0.74, image_url: null,
    category: { id: 3, name: 'Vegetables', icon: '🥬' },
  },
  {
    id: 10, name: 'Sok pomarańczowy', quantity: 1, unit: 'L', location: 'Lodówka',
    expiry_date: addDays(now, 7).toISOString(), status: 'fresh',
    ai_verified: true, ai_confidence: 0.98, image_url: null,
    category: { id: 8, name: 'Drinks', icon: '🧃' },
  },
];

export const MOCK_PENDING = MOCK_ITEMS.filter(i => !i.ai_verified);

export const computeStats = (items: FoodItem[]) => ({
  total: items.length,
  fresh: items.filter(i => i.status === 'fresh').length,
  expiringSoon: items.filter(i => i.status === 'expiring_soon').length,
  expired: items.filter(i => i.status === 'expired').length,
  zeroWasteScore: items.length
    ? Math.round((items.filter(i => i.status === 'fresh').length / items.length) * 100)
    : 100,
});
