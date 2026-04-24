/**
 * PantryScreen — Mock data, full list view
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, parseISO } from 'date-fns';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { MOCK_ITEMS, FoodItem, ItemStatus } from '../data/mockData';

const STATUS_COLORS: Record<ItemStatus, string> = {
  fresh: Colors.statusFresh,
  expiring_soon: Colors.accentYellow,
  expired: Colors.statusExpired,
  pending_verification: Colors.textMuted,
};
const STATUS_LABELS: Record<ItemStatus, string> = {
  fresh: 'Świeże',
  expiring_soon: 'Kończące się',
  expired: 'Przeterminowane',
  pending_verification: 'Niesprawdzone',
};

function ItemRow({ item }: { item: FoodItem }) {
  const days = item.expiry_date
    ? differenceInDays(parseISO(item.expiry_date), new Date())
    : null;
  const color = STATUS_COLORS[item.status];

  return (
    <View style={s.row}>
      <Text style={s.rowEmoji}>{item.category?.icon ?? '🍽️'}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowName}>{item.name}</Text>
        <Text style={s.rowMeta}>{item.quantity} {item.unit} · {item.location}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[s.statusBadge, { backgroundColor: color + '22', borderColor: color, borderWidth: 1 }]}>
          <Text style={[s.statusText, { color }]}>{STATUS_LABELS[item.status]}</Text>
        </View>
        {days !== null && (
          <Text style={[s.days, { color }]}>
            {days < 0 ? 'Po terminie' : days === 0 ? 'Dziś!' : `${days} dni`}
          </Text>
        )}
      </View>
    </View>
  );
}

const FILTERS: (ItemStatus | 'all')[] = ['all', 'fresh', 'expiring_soon', 'expired'];
const FILTER_LABELS = { all: 'Wszystkie', fresh: 'Świeże', expiring_soon: 'Kończące się', expired: 'Przeterminowane' };

export default function PantryScreen() {
  const [filter, setFilter] = useState<ItemStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const items = MOCK_ITEMS
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>🗂️ Spiżarnia</Text>
        <Text style={s.subtitle}>{MOCK_ITEMS.length} produktów</Text>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Szukaj produktu…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={s.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && s.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {FILTER_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => <ItemRow item={item} />}
        contentContainerStyle={{ padding: Spacing.base, gap: Spacing.sm, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 40 }}>Brak produktów</Text>
        )}
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.8}
        onPress={() => console.log('Dodaj nowy item')}
      >
        <Ionicons name="add" size={32} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primaryBg },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  title: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: 2 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    marginHorizontal: Spacing.base, marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, ...Shadows.card,
  },
  searchInput: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary },

  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.base, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSizes.xs, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    padding: Spacing.md, ...Shadows.card,
  },
  rowEmoji: { fontSize: 28, width: 40, textAlign: 'center' },
  rowName: { fontSize: FontSizes.base, fontWeight: '700', color: Colors.textPrimary },
  rowMeta: { fontSize: FontSizes.xs, color: Colors.textMuted },
  statusBadge: { borderRadius: Radii.sm, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  days: { fontSize: FontSizes.xs, fontWeight: '600' },

  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.base,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.strong,
  },
});
