/**
 * DailyCheckScreen — simple button verification, no reanimated/swipe
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { MOCK_PENDING, FoodItem } from '../data/mockData';

export default function DailyCheckScreen({ navigation }: any) {
  const [items, setItems] = useState<FoodItem[]>(MOCK_PENDING);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);

  if (done || items.length === 0) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.doneBox}>
          <Text style={{ fontSize: 64, textAlign: 'center' }}>🎉</Text>
          <Text style={s.doneTitle}>Daily Check ukończony!</Text>
          <Text style={s.doneSub}>
            Sprawdziłeś {items.length} produkt{items.length !== 1 ? 'ów' : ''}. AI zaktualizuje predykcje.
          </Text>
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}>
            <Text style={s.closeBtnText}>Wróć do dashboardu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const item = items[current];
  const progress = (current / items.length) * 100;

  const confirm = () => {
    if (current + 1 >= items.length) setDone(true);
    else setCurrent(c => c + 1);
  };
  const reject = () => {
    if (current + 1 >= items.length) setDone(true);
    else setCurrent(c => c + 1);
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn2}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Daily Check</Text>
        <Text style={s.counter}>{current + 1}/{items.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progress + (100 / items.length)}%` as any }]} />
      </View>

      {/* Card */}
      <View style={s.cardWrap}>
        <View style={s.card}>
          <Text style={{ fontSize: 80, textAlign: 'center', marginBottom: 8 }}>
            {item.category?.icon ?? '🍽️'}
          </Text>
          <Text style={s.cardName}>{item.name}</Text>
          <Text style={s.cardMeta}>{item.quantity} {item.unit} · {item.location}</Text>

          <View style={s.confidenceRow}>
            <Ionicons name="sparkles" size={14} color={Colors.primaryDark} />
            <Text style={s.confidenceText}>
              AI pewność: {item.ai_confidence ? Math.round(item.ai_confidence * 100) : '—'}%
            </Text>
          </View>

          <Text style={s.question}>Czy ten produkt jest nadal dobry?</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={s.actions}>
        <TouchableOpacity style={[s.actionBtn, s.rejectBtn]} onPress={reject}>
          <Ionicons name="close-circle-outline" size={28} color={Colors.statusExpired} />
          <Text style={[s.actionText, { color: Colors.statusExpired }]}>NIE</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.actionBtn, s.confirmBtn]} onPress={confirm}>
          <Ionicons name="checkmark-circle-outline" size={28} color={Colors.statusFresh} />
          <Text style={[s.actionText, { color: Colors.statusFresh }]}>TAK</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.hint}>Twoje odpowiedzi uczą AI lepszych predykcji</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primaryBg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  closeBtn2: { padding: 6 },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },
  counter: { fontSize: FontSizes.sm, color: Colors.textMuted, fontWeight: '600' },

  progressTrack: {
    height: 6, backgroundColor: Colors.primaryBgMid, marginHorizontal: Spacing.base,
    borderRadius: Radii.full, overflow: 'hidden', marginBottom: Spacing.lg,
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: Radii.full },

  cardWrap: { flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  card: {
    backgroundColor: Colors.white, borderRadius: Radii.xl, padding: Spacing['2xl'],
    alignItems: 'center', ...Shadows.strong,
  },
  cardName: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  cardMeta: { fontSize: FontSizes.base, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md },

  confidenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryBgMid, borderRadius: Radii.full,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: Spacing.lg,
  },
  confidenceText: { fontSize: FontSizes.sm, color: Colors.primaryDark, fontWeight: '700' },
  question: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },

  actions: {
    flexDirection: 'row', gap: Spacing.xl, paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg, justifyContent: 'center',
  },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: Radii.xl,
    paddingVertical: Spacing.lg, ...Shadows.strong,
  },
  rejectBtn: { borderWidth: 2, borderColor: Colors.statusExpired + '40' },
  confirmBtn: { borderWidth: 2, borderColor: Colors.statusFresh + '40' },
  actionText: { fontSize: FontSizes.lg, fontWeight: '900' },

  hint: { textAlign: 'center', fontSize: FontSizes.xs, color: Colors.textMuted, paddingBottom: Spacing.xl },

  doneBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: Spacing.md },
  doneTitle: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  doneSub: { fontSize: FontSizes.base, color: Colors.textSecondary, textAlign: 'center' },
  closeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.lg,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.md,
  },
  closeBtnText: { color: Colors.white, fontWeight: '800', fontSize: FontSizes.base },
});
