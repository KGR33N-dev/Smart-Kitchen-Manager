import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { Recipe, RecipeSummary, recipesApi } from '../api/client';

export default function RecipesScreen({ navigation, route }: any) {
  const [items, setItems] = useState<RecipeSummary[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (q?: string) => {
    setLoading(true);
    try { setItems(await recipesApi.list(q)); } catch { /* ignore */ }
    finally { setLoading(false); }
  };
  const open = async (id: number) => {
    setLoading(true);
    try { setSelected(await recipesApi.get(id)); } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (route?.params?.recipeId) open(route.params.recipeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detail ──────────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={s.hBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{selected.name}</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.base }}>
          <Text style={s.desc}>{selected.description}</Text>
          <View style={s.metaRow}>
            <View style={s.metaPill}><Ionicons name="time-outline" size={14} color={Colors.primaryDark} /><Text style={s.metaText}>{selected.prep_minutes} min</Text></View>
            <View style={s.metaPill}><Ionicons name="people-outline" size={14} color={Colors.primaryDark} /><Text style={s.metaText}>{selected.servings} porcje</Text></View>
          </View>

          <Text style={s.sectionTitle}>Składniki</Text>
          {selected.ingredients.map(i => (
            <View key={i.id} style={s.ingRow}>
              <Ionicons name="ellipse" size={7} color={Colors.primary} />
              <Text style={s.ingName}>{i.name}</Text>
              <Text style={s.ingQty}>{i.quantity % 1 === 0 ? i.quantity : i.quantity}{' '}{i.unit}</Text>
            </View>
          ))}

          <Text style={s.sectionTitle}>Przygotowanie</Text>
          <Text style={s.instructions}>{selected.instructions}</Text>

          <TouchableOpacity
            style={s.cookBtn}
            onPress={() => navigation.navigate('Main', { screen: 'Chat', params: { prefill: `Chcę zrobić ${selected.name}` } })}
          >
            <Ionicons name="sparkles" size={18} color={Colors.white} />
            <Text style={s.cookBtnText}>Sprawdź czego brakuje</Text>
          </TouchableOpacity>
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.hBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Przepisy</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Szukaj przepisu…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={t => { setQuery(t); load(t); }}
        />
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={{ padding: Spacing.base, gap: Spacing.sm }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => open(item.id)}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={s.cardMeta}>⏱ {item.prep_minutes} min · {item.servings} porcje</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 40 }}>Brak przepisów</Text>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primaryBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hBtn: { padding: 4, minWidth: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    margin: Spacing.base, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, ...Shadows.card,
  },
  searchInput: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: Radii.lg, padding: Spacing.md, ...Shadows.card,
  },
  cardTitle: { fontSize: FontSizes.base, fontWeight: '800', color: Colors.textPrimary },
  cardDesc: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 4 },

  desc: { fontSize: FontSizes.base, color: Colors.textSecondary, lineHeight: 21 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm, marginBottom: Spacing.md },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryBgMid, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 5,
  },
  metaText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primaryDark },

  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  ingName: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary },
  ingQty: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },
  instructions: { fontSize: FontSizes.base, color: Colors.textSecondary, lineHeight: 23 },

  cookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radii.lg, paddingVertical: 15, marginTop: Spacing.lg, ...Shadows.card,
  },
  cookBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSizes.base },
});
