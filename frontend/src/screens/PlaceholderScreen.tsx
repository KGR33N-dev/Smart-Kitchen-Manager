import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../theme';

interface Props {
  route?: { params?: { title?: string; icon?: string; description?: string } };
}

export default function PlaceholderScreen({ route }: Props) {
  const title = route?.params?.title ?? 'Wkrótce dostępne';
  const icon = route?.params?.icon ?? 'construct-outline';
  const desc = route?.params?.description ?? 'Ta funkcja jest w trakcie implementacji.';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Ionicons name={icon as any} size={64} color={Colors.primaryLight} />
        <Text style={s.title}>{title}</Text>
        <Text style={s.desc}>{desc}</Text>
        <View style={s.pill}>
          <Text style={s.pillText}>🚀 Będzie dostępne wkrótce</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primaryBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'], gap: 16 },
  title: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  desc: { fontSize: FontSizes.base, color: Colors.textSecondary, textAlign: 'center' },
  pill: {
    backgroundColor: Colors.primaryBgMid, borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 8,
  },
  pillText: { fontSize: FontSizes.sm, color: Colors.primaryDark, fontWeight: '700' },
});
