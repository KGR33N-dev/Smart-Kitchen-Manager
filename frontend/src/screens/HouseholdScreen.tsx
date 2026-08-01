import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { HouseholdMember, householdsApi } from '../api/client';
import { useHouseholdStore } from '../store/householdStore';
import { usePantryStore } from '../store/pantryStore';

export default function HouseholdScreen({ navigation }: any) {
  const households = useHouseholdStore(s => s.households);
  const isLoading = useHouseholdStore(s => s.isLoading);
  const fetch = useHouseholdStore(s => s.fetch);
  const create = useHouseholdStore(s => s.create);
  const join = useHouseholdStore(s => s.join);
  const switchTo = useHouseholdStore(s => s.switchTo);
  const refreshPantry = usePantryStore(s => s.refreshAll);

  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [busy, setBusy] = useState(false);

  const active = households.find(h => h.is_active);

  const loadMembers = useCallback(async () => {
    if (active) {
      try { setMembers(await householdsApi.members(active.id)); } catch { setMembers([]); }
    }
  }, [active?.id]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const afterContextChange = async () => {
    await refreshPantry();
    await loadMembers();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try { await create(newName.trim()); setNewName(''); await afterContextChange(); }
    catch (e: any) { Alert.alert('Błąd', e?.detail ?? 'Nie udało się utworzyć'); }
    finally { setBusy(false); }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await join(code.trim().toUpperCase());
      setCode('');
      await afterContextChange();
      Alert.alert('Dołączono! 🎉', 'Współdzielisz teraz lodówkę, listy i notatki.');
    } catch (e: any) {
      Alert.alert('Błąd', e?.status === 404 ? 'Nieprawidłowy kod zaproszenia' : (e?.detail ?? 'Nie udało się dołączyć'));
    } finally { setBusy(false); }
  };

  const handleSwitch = async (id: number) => {
    setBusy(true);
    try { await switchTo(id); await afterContextChange(); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Gospodarstwo</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {isLoading && <ActivityIndicator color={Colors.primary} />}

        {/* Active household + invite code */}
        {active && (
          <View style={s.activeCard}>
            <Text style={s.activeLabel}>Aktywne gospodarstwo</Text>
            <Text style={s.activeName}>🏠 {active.name}</Text>
            <Text style={s.activeMeta}>{active.member_count} {active.member_count === 1 ? 'osoba' : 'osób'}</Text>

            <Text style={s.codeLabel}>Kod zaproszenia (udostępnij rodzinie):</Text>
            <View style={s.codeBox}>
              <Text style={s.codeText}>{active.join_code}</Text>
            </View>
          </View>
        )}

        {/* Members */}
        {members.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Członkowie</Text>
            {members.map(m => (
              <View key={m.user_id} style={s.memberRow}>
                <Ionicons
                  name={m.role === 'owner' ? 'star' : 'person'}
                  size={16}
                  color={m.role === 'owner' ? Colors.accentYellow : Colors.textMuted}
                />
                <Text style={s.memberName}>{m.full_name}</Text>
                <Text style={s.memberRole}>{m.role === 'owner' ? 'właściciel' : 'członek'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All households / switch */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Twoje gospodarstwa</Text>
          {households.map(h => (
            <TouchableOpacity
              key={h.id}
              style={[s.hhRow, h.is_active && s.hhRowActive]}
              onPress={() => !h.is_active && handleSwitch(h.id)}
              disabled={busy}
            >
              <Text style={s.hhName}>{h.is_personal ? '👤' : '🏠'} {h.name}</Text>
              {h.is_active
                ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                : <Text style={s.hhSwitch}>Przełącz</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Join */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dołącz do gospodarstwa</Text>
          <View style={s.inlineRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Kod zaproszenia"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
            />
            <TouchableOpacity style={s.smallBtn} onPress={handleJoin} disabled={busy}>
              <Text style={s.smallBtnText}>Dołącz</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Create */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Utwórz nowe gospodarstwo</Text>
          <View style={s.inlineRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="np. Domek na działce"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <TouchableOpacity style={s.smallBtn} onPress={handleCreate} disabled={busy}>
              <Text style={s.smallBtnText}>Utwórz</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },

  content: { padding: Spacing.base, gap: Spacing.base },

  activeCard: { backgroundColor: Colors.white, borderRadius: Radii.xl, padding: Spacing.lg, ...Shadows.card },
  activeLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  activeName: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary, marginTop: 4 },
  activeMeta: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  codeLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.md, marginBottom: 6 },
  codeBox: {
    backgroundColor: Colors.primaryBgMid, borderRadius: Radii.lg, paddingVertical: 14, alignItems: 'center',
  },
  codeText: { fontSize: 28, fontWeight: '900', letterSpacing: 6, color: Colors.primaryDark },

  section: { backgroundColor: Colors.white, borderRadius: Radii.lg, padding: Spacing.md, ...Shadows.card, gap: 10 },
  sectionTitle: { fontSize: FontSizes.base, fontWeight: '800', color: Colors.textPrimary },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary, fontWeight: '600' },
  memberRole: { fontSize: FontSizes.xs, color: Colors.textMuted },

  hhRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border,
  },
  hhRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  hhName: { fontSize: FontSizes.base, fontWeight: '700', color: Colors.textPrimary },
  hhSwitch: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '700' },

  inlineRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 12, fontSize: FontSizes.base, color: Colors.textPrimary,
  },
  smallBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.md, paddingHorizontal: 16, paddingVertical: 12,
  },
  smallBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSizes.sm },
});
