import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { ShoppingList, shoppingApi } from '../api/client';

export default function ShoppingScreen() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = await shoppingApi.lists();
      if (data.length === 0) {
        await shoppingApi.createList('Lista zakupów');
        data = await shoppingApi.lists();
      }
      setLists(data);
    } catch { /* offline / error */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addItem = async (listId: number) => {
    const name = (drafts[listId] ?? '').trim();
    if (!name) return;
    setDrafts(d => ({ ...d, [listId]: '' }));
    try { await shoppingApi.addItem(listId, { name }); await load(); }
    catch (e: any) { Alert.alert('Błąd', e?.detail ?? 'Nie udało się dodać'); }
  };

  const toggle = async (itemId: number, checked: boolean) => {
    // optimistic
    setLists(ls => ls.map(l => ({ ...l, items: l.items.map(i => i.id === itemId ? { ...i, is_checked: checked } : i) })));
    try { await shoppingApi.updateItem(itemId, { is_checked: checked }); }
    catch { load(); }
  };

  const removeItem = (itemId: number) => {
    Alert.alert('Usunąć pozycję?', '', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => { await shoppingApi.deleteItem(itemId).catch(() => {}); load(); } },
    ]);
  };

  const newList = async () => {
    await shoppingApi.createList('Nowa lista').catch(() => {});
    load();
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>🛒 Zakupy</Text>
        <TouchableOpacity onPress={newList} style={s.addListBtn}>
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={s.addListText}>Lista</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
      >
        {lists.map(list => {
          const remaining = list.items.filter(i => !i.is_checked).length;
          return (
            <View key={list.id} style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.listName}>{list.name}</Text>
                <Text style={s.listMeta}>{remaining} do kupienia</Text>
              </View>

              {list.items.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={s.itemRow}
                  onPress={() => toggle(item.id, !item.is_checked)}
                  onLongPress={() => removeItem(item.id)}
                >
                  <Ionicons
                    name={item.is_checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={item.is_checked ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[s.itemName, item.is_checked && s.itemChecked]}>{item.name}</Text>
                  {item.quantity !== 1 || item.unit !== 'szt.' ? (
                    <Text style={s.itemQty}>{item.quantity} {item.unit}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}

              <View style={s.addRow}>
                <TextInput
                  style={s.addInput}
                  placeholder="Dodaj produkt…"
                  placeholderTextColor={Colors.textMuted}
                  value={drafts[list.id] ?? ''}
                  onChangeText={t => setDrafts(d => ({ ...d, [list.id]: t }))}
                  onSubmitEditing={() => addItem(list.id)}
                  returnKeyType="done"
                />
                <TouchableOpacity style={s.addBtn} onPress={() => addItem(list.id)}>
                  <Ionicons name="add" size={22} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <Text style={s.hint}>Przytrzymaj produkt, aby usunąć. Listy są wspólne dla całego gospodarstwa.</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primaryBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary },
  addListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary,
    borderRadius: Radii.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  addListText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.sm },

  content: { padding: Spacing.base, gap: Spacing.base },
  card: { backgroundColor: Colors.white, borderRadius: Radii.lg, padding: Spacing.md, ...Shadows.card, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  listName: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },
  listMeta: { fontSize: FontSizes.xs, color: Colors.textMuted },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  itemName: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary },
  itemChecked: { textDecorationLine: 'line-through', color: Colors.textMuted },
  itemQty: { fontSize: FontSizes.xs, color: Colors.textMuted },

  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  addInput: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, paddingHorizontal: Spacing.sm, paddingVertical: 10,
    fontSize: FontSizes.base, color: Colors.textPrimary,
  },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, padding: 10 },

  hint: { fontSize: FontSizes.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
});
