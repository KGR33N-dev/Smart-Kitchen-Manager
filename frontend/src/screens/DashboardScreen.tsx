/**
 * DashboardScreen — Mock data + live user from backend
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, parseISO } from 'date-fns';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { MOCK_ITEMS, computeStats, FoodItem } from '../data/mockData';
import type { UserOut } from '../api/client';

interface DashboardProps { navigation: any; user?: UserOut; onLogout?: () => void; }

const { width } = Dimensions.get('window');

// ─── Zero Waste Gauge ────────────────────────────────────────────────────────

function ZeroWasteGauge({ score }: { score: number }) {
  const color = score > 80 ? Colors.statusFresh : score > 50 ? Colors.accentYellow : Colors.statusExpired;
  return (
    <View style={s.gaugeCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={s.gaugeLabel}>Zero Waste Goal</Text>
          <Text style={s.gaugeSub}>Twój wynik tego tygodnia</Text>
        </View>
        <Text style={[s.gaugePct, { color }]}>{score}%</Text>
      </View>
      <View style={[s.gaugeTrack]}>
        <View style={[s.gaugeFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Ionicons name="leaf-outline" size={14} color={Colors.primaryDark} />
        <Text style={s.gaugeFooter}>Szacowane oszczędności: 12,40 zł · 2.1 kg CO₂ mniej</Text>
      </View>
    </View>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ fresh, expiring, expired }: { fresh: number; expiring: number; expired: number }) {
  return (
    <View style={s.statsRow}>
      {[
        { label: 'Świeże', count: fresh, color: Colors.statusFresh, icon: 'leaf' as const },
        { label: 'Kończące się', count: expiring, color: Colors.accentYellow, icon: 'time-outline' as const },
        { label: 'Przeterminowane', count: expired, color: Colors.statusExpired, icon: 'warning-outline' as const },
      ].map(stat => (
        <View key={stat.label} style={s.statCard}>
          <Ionicons name={stat.icon} size={20} color={stat.color} />
          <Text style={[s.statCount, { color: stat.color }]}>{stat.count}</Text>
          <Text style={s.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Expiring Card ────────────────────────────────────────────────────────────

function ExpiringCard({ item }: { item: FoodItem }) {
  const days = item.expiry_date
    ? differenceInDays(parseISO(item.expiry_date), new Date())
    : 99;
  const badgeColor =
    days < 0 ? Colors.statusExpired : days <= 1 ? Colors.accentOrange : Colors.accentYellow;
  const daysLabel =
    days < 0 ? 'Po terminie' : days === 0 ? 'Dziś!' : `${days}d`;

  return (
    <View style={s.expiryCard}>
      <Text style={{ fontSize: 32, textAlign: 'center' }}>{item.category?.icon ?? '🍽️'}</Text>
      <View style={[s.expiryBadge, { backgroundColor: badgeColor }]}>
        <Text style={s.expiryBadgeText}>{daysLabel}</Text>
      </View>
      <Text style={s.expiryName} numberOfLines={2}>{item.name}</Text>
      <Text style={s.expiryCat}>{item.quantity} {item.unit}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation, user, onLogout }: DashboardProps) {
  const stats = computeStats(MOCK_ITEMS);
  const expiring = MOCK_ITEMS.filter(i => i.status === 'expiring_soon' || i.status === 'expired');
  const displayName = user?.full_name?.split(' ')[0] ?? 'Sarah';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>🌿 FreshTrack</Text>
            <Text style={s.greeting}>Cześć, {displayName}! 👋</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {user?.is_premium && (
              <View style={s.premiumBadge}>
                <Ionicons name="star" size={10} color="#FFD700" />
                <Text style={s.premiumText}>PRO</Text>
              </View>
            )}
            <TouchableOpacity style={s.bellBtn} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Gauge */}
        <ZeroWasteGauge score={stats.zeroWasteScore} />

        {/* Stats */}
        <StatsRow fresh={stats.fresh} expiring={stats.expiringSoon} expired={stats.expired} />

        {/* CTAs */}
        <View style={s.ctaRow}>
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: Colors.primary }]}
            onPress={() => { }}
          >
            <Ionicons name="camera-outline" size={18} color={Colors.white} />
            <Text style={s.ctaBtnText}>Skanuj paragon</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: Colors.primaryDark }]}
            onPress={() => navigation.navigate('DailyCheck')}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
            <Text style={s.ctaBtnText}>Daily Check</Text>
          </TouchableOpacity>
        </View>

        {/* Expiring soon */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Kończy się termin</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Pantry')}>
            <Text style={s.viewAll}>Zobacz wszystkie</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {expiring.map(item => (
            <ExpiringCard key={item.id} item={item} />
          ))}
        </ScrollView>

        {/* AI insight pill */}
        <View style={s.insightCard}>
          <Ionicons name="sparkles" size={18} color={Colors.primaryDark} />
          <Text style={s.insightText}>
            AI sugeruje: Użyj mleka i szpinaku dziś — idealny zestaw na smoothie!
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primaryBg },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: 20 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginTop: Spacing.md, marginBottom: Spacing.base,
  },
  logo: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primaryDark },
  greeting: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary, marginTop: 2 },

  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#1B3A1C', borderRadius: Radii.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  premiumText: { color: '#FFD700', fontSize: FontSizes.xs, fontWeight: '900' },
  bellBtn: { position: 'relative', padding: 6 },
  bellDot: {
    position: 'absolute', top: 8, right: 8, width: 8, height: 8,
    borderRadius: 4, backgroundColor: Colors.accentRed, borderWidth: 1.5, borderColor: Colors.primaryBg,
  },

  gaugeCard: {
    backgroundColor: Colors.white, borderRadius: Radii.xl,
    padding: Spacing.lg, ...Shadows.card, marginBottom: Spacing.base,
  },
  gaugeLabel: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },
  gaugeSub: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  gaugePct: { fontSize: 44, fontWeight: '900' },
  gaugeTrack: {
    height: 10, borderRadius: Radii.full, backgroundColor: Colors.primaryBgMid,
    overflow: 'hidden', marginVertical: 12,
  },
  gaugeFill: { height: '100%', borderRadius: Radii.full },
  gaugeFooter: { fontSize: FontSizes.sm, color: Colors.primaryDark, fontWeight: '600', flexShrink: 1 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  statCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radii.lg,
    padding: Spacing.md, alignItems: 'center', gap: 4, ...Shadows.card,
  },
  statCount: { fontSize: FontSizes.xl, fontWeight: '900' },
  statLabel: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  ctaRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  ctaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: Radii.lg, paddingVertical: Spacing.md, gap: 7, ...Shadows.card,
  },
  ctaBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.sm },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },
  viewAll: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },

  expiryCard: {
    backgroundColor: Colors.white, borderRadius: Radii.lg, padding: Spacing.sm,
    marginRight: Spacing.sm, width: 110, ...Shadows.card, alignItems: 'center', gap: 4,
  },
  expiryBadge: { borderRadius: Radii.sm, paddingHorizontal: 6, paddingVertical: 2 },
  expiryBadgeText: { color: Colors.white, fontSize: FontSizes.xs, fontWeight: '800' },
  expiryName: { fontSize: FontSizes.xs + 1, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  expiryCat: { fontSize: FontSizes.xs, color: Colors.textMuted },

  insightCard: {
    backgroundColor: Colors.primaryBgMid, borderRadius: Radii.lg,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.base,
  },
  insightText: { flex: 1, fontSize: FontSizes.sm, color: Colors.primaryDark, fontWeight: '600', lineHeight: 18 },
});
