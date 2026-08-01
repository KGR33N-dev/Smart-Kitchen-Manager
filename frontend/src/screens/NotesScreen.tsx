import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { TaskPeriod } from '../api/client';
import { LocalNote, useNotesStore } from '../store/notesStore';
import { useHouseholdStore } from '../store/householdStore';
import { configureNotifications } from '../lib/notifications';

const PERIODS: { key: TaskPeriod; label: string; icon: any }[] = [
  { key: 'daily', label: 'Codzienne', icon: 'today-outline' },
  { key: 'weekly', label: 'Tygodniowe', icon: 'calendar-outline' },
  { key: 'monthly', label: 'Miesięczne', icon: 'calendar-number-outline' },
];

export default function NotesScreen() {
  const syncing = useNotesStore(s => s.syncing);
  const online = useNotesStore(s => s.online);
  const setHousehold = useNotesStore(s => s.setHousehold);
  const upsert = useNotesStore(s => s.upsert);
  const toggleDone = useNotesStore(s => s.toggleDone);
  const remove = useNotesStore(s => s.remove);
  const sync = useNotesStore(s => s.sync);
  const byPeriod = useNotesStore(s => s.byPeriod);
  // subscribe to notes so the list re-renders on change
  useNotesStore(s => s.notes);

  const households = useHouseholdStore(s => s.households);
  const fetchHouseholds = useHouseholdStore(s => s.fetch);
  const activeId = households.find(h => h.is_active)?.id ?? null;

  const [tab, setTab] = useState<TaskPeriod>('daily');
  const [draft, setDraft] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [editing, setEditing] = useState<LocalNote | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eContent, setEContent] = useState('');
  const [eTime, setETime] = useState('');

  useEffect(() => { configureNotifications(); }, []);
  useEffect(() => { if (households.length === 0) fetchHouseholds(); }, []);
  useFocusEffect(useCallback(() => { if (activeId != null) setHousehold(activeId); }, [activeId, setHousehold]));

  const tasks = byPeriod(tab);

  const quickAdd = async () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    const time = draftTime.trim();
    setDraft(''); setDraftTime('');
    await upsert({ title: text, period: tab, remind_at: time || null });
  };

  const openEdit = (n: LocalNote) => {
    setEditing(n); setETitle(n.title); setEContent(n.content); setETime(n.remind_at ?? '');
  };
  const closeEdit = () => setEditing(null);
  const saveEdit = async () => {
    if (!editing) return;
    await upsert({
      client_id: editing.client_id,
      title: eTitle.trim() || 'Zadanie',
      content: eContent.trim(),
      period: editing.period,
      remind_at: eTime.trim() || null,
      is_done: editing.is_done,
    });
    closeEdit();
  };
  const del = (n: LocalNote) => {
    Alert.alert('Usunąć?', n.title, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { remove(n.client_id); closeEdit(); } },
    ]);
  };

  // ── Editor ────────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <TouchableOpacity onPress={closeEdit} style={s.hBtn}><Ionicons name="close" size={24} color={Colors.textPrimary} /></TouchableOpacity>
            <Text style={s.headerTitle}>Edytuj</Text>
            <TouchableOpacity onPress={saveEdit} style={s.hBtn}><Ionicons name="checkmark" size={26} color={Colors.primary} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.base }}>
            <TextInput style={s.titleInput} placeholder="Zadanie" placeholderTextColor={Colors.textMuted} value={eTitle} onChangeText={setETitle} />
            <View style={s.timeField}>
              <Ionicons name="alarm-outline" size={18} color={Colors.textSecondary} />
              <TextInput
                style={s.timeInput}
                placeholder="Godzina przypomnienia, np. 08:30"
                placeholderTextColor={Colors.textMuted}
                value={eTime}
                onChangeText={setETime}
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
              {!!eTime && (
                <TouchableOpacity onPress={() => setETime('')}><Ionicons name="close-circle" size={18} color={Colors.textMuted} /></TouchableOpacity>
              )}
            </View>
            <TextInput style={s.contentInput} placeholder="Notatka (opcjonalnie)…" placeholderTextColor={Colors.textMuted} value={eContent} onChangeText={setEContent} multiline />
            <TouchableOpacity style={s.deleteBtn} onPress={() => del(editing)}>
              <Ionicons name="trash-outline" size={18} color={Colors.statusExpired} />
              <Text style={s.deleteText}>Usuń zadanie</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>📝 Zadania</Text>
        <View style={s.statusWrap}>
          {syncing
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : (
              <View style={s.statusPill}>
                <View style={[s.dot, { backgroundColor: online ? Colors.statusFresh : Colors.textMuted }]} />
                <Text style={s.statusText}>{online ? 'Zsynchronizowane' : 'Offline'}</Text>
              </View>
            )}
          <TouchableOpacity onPress={() => sync()} style={s.syncBtn}><Ionicons name="sync" size={18} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
      </View>

      {/* Period tabs */}
      <View style={s.tabs}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p.key} style={[s.tab, tab === p.key && s.tabActive]} onPress={() => setTab(p.key)}>
            <Ionicons name={p.icon} size={15} color={tab === p.key ? Colors.white : Colors.textSecondary} />
            <Text style={[s.tabText, tab === p.key && s.tabTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {tasks.length === 0 && (
          <Text style={s.emptyText}>Brak zadań. Dodaj poniżej — działa też offline!</Text>
        )}
        {tasks.map(n => (
          <TouchableOpacity key={n.client_id} style={s.row} onPress={() => openEdit(n)} onLongPress={() => del(n)}>
            <TouchableOpacity onPress={() => toggleDone(n.client_id)} hitSlop={8}>
              <Ionicons name={n.is_done ? 'checkbox' : 'square-outline'} size={24} color={n.is_done ? Colors.primary : Colors.textMuted} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, n.is_done && s.rowDone]} numberOfLines={1}>{n.title}</Text>
              {!!n.content && <Text style={s.rowContent} numberOfLines={1}>{n.content}</Text>}
            </View>
            {!!n.remind_at && (
              <View style={s.timeBadge}>
                <Ionicons name="alarm" size={12} color={Colors.primaryDark} />
                <Text style={s.timeBadgeText}>{n.remind_at}</Text>
              </View>
            )}
            {n.dirty && <Ionicons name="cloud-upload-outline" size={13} color={Colors.textMuted} />}
          </TouchableOpacity>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Quick add row */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.addBar}>
          <TextInput
            style={s.addInput}
            placeholder={`Nowe zadanie (${PERIODS.find(p => p.key === tab)?.label.toLowerCase()})`}
            placeholderTextColor={Colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={quickAdd}
            returnKeyType="done"
          />
          <TextInput
            style={s.addTime}
            placeholder="hh:mm"
            placeholderTextColor={Colors.textMuted}
            value={draftTime}
            onChangeText={setDraftTime}
            maxLength={5}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity style={s.addBtn} onPress={quickAdd}><Ionicons name="add" size={24} color={Colors.white} /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },
  hBtn: { padding: 4, minWidth: 32 },

  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 5, ...Shadows.card,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600' },
  syncBtn: { padding: 4 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: Radii.full, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },

  content: { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingTop: 4 },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 50 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: Radii.lg, padding: Spacing.md, ...Shadows.card,
  },
  rowTitle: { fontSize: FontSizes.base, fontWeight: '700', color: Colors.textPrimary },
  rowDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  rowContent: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  timeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primaryBgMid, borderRadius: Radii.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  timeBadgeText: { fontSize: FontSizes.xs, fontWeight: '800', color: Colors.primaryDark },

  addBar: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    padding: Spacing.sm, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addInput: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: FontSizes.base, color: Colors.textPrimary,
  },
  addTime: {
    width: 68, textAlign: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, paddingVertical: 10, fontSize: FontSizes.sm, color: Colors.textPrimary,
  },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, padding: 9 },

  titleInput: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary, paddingVertical: 8 },
  timeField: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
  },
  timeInput: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary },
  contentInput: {
    fontSize: FontSizes.base, color: Colors.textPrimary, marginTop: 12, minHeight: 140,
    textAlignVertical: 'top', lineHeight: 22,
  },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.lg, alignSelf: 'flex-start' },
  deleteText: { color: Colors.statusExpired, fontWeight: '700', fontSize: FontSizes.sm },
});
