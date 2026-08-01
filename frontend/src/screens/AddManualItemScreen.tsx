import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { categoriesApi, Category } from '../api/client';
import { usePantryStore } from '../store/pantryStore';

export default function AddManualItemScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('szt.');
  const [location, setLocation] = useState('Lodówka');
  const [expiryDays, setExpiryDays] = useState('7');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createItem = usePantryStore(s => s.createItem);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nazwa produktu jest wymagana.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let expiry_date: string | null = null;
      const days = parseInt(expiryDays, 10);
      if (!Number.isNaN(days)) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        expiry_date = d.toISOString();
      }
      await createItem({
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit: unit.trim() || 'szt.',
        location: location.trim() || 'Lodówka',
        expiry_date,
        category_id: categoryId,
      });
      navigation.goBack();
    } catch (e: any) {
      setError(e?.detail || 'Wystąpił błąd podczas dodawania produktu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Dodaj produkt ręcznie</Text>
          <View style={s.placeholder} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.inputGroup}>
            <Text style={s.label}>Nazwa produktu *</Text>
            <TextInput
              style={s.input}
              placeholder="np. Czekolada gorzka"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={s.row}>
            <View style={[s.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
              <Text style={s.label}>Ilość</Text>
              <TextInput
                style={s.input}
                placeholder="1"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={[s.inputGroup, { flex: 1 }]}>
              <Text style={s.label}>Jednostka</Text>
              <TextInput
                style={s.input}
                placeholder="szt."
                placeholderTextColor={Colors.textMuted}
                value={unit}
                onChangeText={setUnit}
              />
            </View>
          </View>

          <View style={s.row}>
            <View style={[s.inputGroup, { flex: 1, marginRight: Spacing.sm }]}>
              <Text style={s.label}>Miejsce</Text>
              <TextInput
                style={s.input}
                placeholder="Lodówka, Spiżarnia..."
                placeholderTextColor={Colors.textMuted}
                value={location}
                onChangeText={setLocation}
              />
            </View>
            <View style={[s.inputGroup, { flex: 1 }]}>
              <Text style={s.label}>Ważne (dni)</Text>
              <TextInput
                style={s.input}
                placeholder="7"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={expiryDays}
                onChangeText={setExpiryDays}
              />
            </View>
          </View>

          {categories.length > 0 && (
            <View style={s.inputGroup}>
              <Text style={s.label}>Kategoria</Text>
              <View style={s.chips}>
                {categories.map(c => {
                  const active = categoryId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setCategoryId(active ? null : c.id)}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>
                        {c.icon} {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.submitBtn, loading && s.submitBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.submitText}>Zapisz w spiżarni</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  placeholder: { width: 32 },

  content: { padding: Spacing.base, paddingBottom: 40 },

  inputGroup: { marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  label: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    fontSize: FontSizes.md, color: Colors.textPrimary,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.white },

  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16, borderRadius: Radii.lg,
    alignItems: 'center', marginTop: Spacing.lg,
    ...Shadows.card,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '800' },

  errorBox: {
    backgroundColor: '#FFE5E5', padding: Spacing.sm, borderRadius: Radii.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.statusExpired,
  },
  errorText: { color: Colors.statusExpired, fontSize: FontSizes.sm, fontWeight: '600' },
});
