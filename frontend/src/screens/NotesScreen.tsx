import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { LocalNote, useNotesStore } from '../store/notesStore';
import { useHouseholdStore } from '../store/householdStore';

export default function NotesScreen() {
  const notes = useNotesStore(s => s.visible());
  const syncing = useNotesStore(s => s.syncing);
  const online = useNotesStore(s => s.online);
  const setHousehold = useNotesStore(s => s.setHousehold);
  const upsert = useNotesStore(s => s.upsert);
  const remove = useNotesStore(s => s.remove);
  const sync = useNotesStore(s => s.sync);

  const households = useHouseholdStore(s => s.households);
  const fetchHouseholds = useHouseholdStore(s => s.fetch);
  const activeId = households.find(h => h.is_active)?.id ?? null;

  const [editing, setEditing] = useState<LocalNote | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => { if (households.length === 0) fetchHouseholds(); }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeId != null) setHousehold(activeId);
    }, [activeId, setHousehold]),
  );

  const openNew = () => { setTitle(''); setContent(''); setEditing('new'); };
  const openEdit = (n: LocalNote) => { setTitle(n.title); setContent(n.content); setEditing(n); };
  const close = () => setEditing(null);

  const save = async () => {
    if (!title.trim() && !content.trim()) { close(); return; }
    await upsert({
      client_id: editing && editing !== 'new' ? editing.client_id : undefined,
      title: title.trim() || 'Bez tytułu',
      content: content.trim(),
    });
    close();
  };

  const del = (n: LocalNote) => {
    Alert.alert('Usunąć notatkę?', n.title, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { remove(n.client_id); close(); } },
    ]);
  };

  // ── Editor overlay ──────────────────────────────────────────────────────────
  if (editing) {
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <TouchableOpacity onPress={close} style={s.hBtn}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>{editing === 'new' ? 'Nowa notatka' : 'Edytuj'}</Text>
            <TouchableOpacity onPress={save} style={s.hBtn}>
              <Ionicons name="checkmark" size={26} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.base }}>
            <TextInput
              style={s.titleInput}
              placeholder="Tytuł"
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={s.contentInput}
              placeholder="Zacznij pisać…"
              placeholderTextColor={Colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
            />
            {editing !== 'new' && (
              <TouchableOpacity style={s.deleteBtn} onPress={() => del(editing)}>
                <Ionicons name="trash-outline" size={18} color={Colors.statusExpired} />
                <Text style={s.deleteText}>Usuń notatkę</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>📝 Notatki</Text>
        <View style={s.statusWrap}>
          {syncing
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : (
              <View style={s.statusPill}>
                <View style={[s.dot, { backgroundColor: online ? Colors.statusFresh : Colors.textMuted }]} />
                <Text style={s.statusText}>{online ? 'Zsynchronizowane' : 'Offline'}</Text>
              </View>
            )}
          <TouchableOpacity onPress={() => sync()} style={s.syncBtn}>
            <Ionicons name="sync" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {notes.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={56} color={Colors.primaryLight} />
            <Text style={s.emptyText}>Brak notatek. Działają też offline!</Text>
          </View>
        )}
        {notes.map(n => (
          <TouchableOpacity key={n.client_id} style={s.noteCard} onPress={() => openEdit(n)} onLongPress={() => del(n)}>
            <Text style={s.noteTitle} numberOfLines={1}>{n.title}</Text>
            {!!n.content && <Text style={s.noteBody} numberOfLines={3}>{n.content}</Text>}
            <View style={s.noteFooter}>
              {n.dirty && <Ionicons name="cloud-upload-outline" size={12} color={Colors.textMuted} />}
              <Text style={s.noteDate}>{new Date(n.client_updated_at).toLocaleDateString('pl-PL')}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={openNew}>
        <Ionicons name="add" size={32} color={Colors.white} />
      </TouchableOpacity>
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

  content: { padding: Spacing.base, gap: Spacing.sm },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 80 },
  emptyText: { fontSize: FontSizes.base, color: Colors.textMuted },

  noteCard: { backgroundColor: Colors.white, borderRadius: Radii.lg, padding: Spacing.md, ...Shadows.card, gap: 4 },
  noteTitle: { fontSize: FontSizes.base, fontWeight: '800', color: Colors.textPrimary },
  noteBody: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 19 },
  noteFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  noteDate: { fontSize: FontSizes.xs, color: Colors.textMuted },

  titleInput: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary, paddingVertical: 8 },
  contentInput: {
    fontSize: FontSizes.base, color: Colors.textPrimary, marginTop: 8, minHeight: 220,
    textAlignVertical: 'top', lineHeight: 22,
  },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.lg, alignSelf: 'flex-start' },
  deleteText: { color: Colors.statusExpired, fontWeight: '700', fontSize: FontSizes.sm },

  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.strong,
  },
});
