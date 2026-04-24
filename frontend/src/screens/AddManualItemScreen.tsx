import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { itemsApi } from '../api/client';
import { usePantryStore } from '../store/pantryStore';

export default function AddManualItemScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('szt.');
  const [location, setLocation] = useState('Lodówka');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fetchItems } = usePantryStore();

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nazwa przedmiotu jest wymagana.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await itemsApi.create({
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit: unit.trim() || 'szt.',
        location: location.trim() || 'Lodówka',
      });

      // Odśwież stan aplikacji
      await fetchItems();

      // Zrób krok w tył w nawigacji po udanym dodaniu
      navigation.goBack();
    } catch (e: any) {
      setError(e.detail || 'Wystąpił błąd podczas dodawania przedmiotu.');
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

          <View style={s.inputGroup}>
            <Text style={s.label}>Gdzie to przechowujesz?</Text>
            <TextInput
              style={s.input}
              placeholder="Lodówka, Spiżarnia..."
              placeholderTextColor={Colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />
          </View>

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

  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16, borderRadius: Radii.lg,
    alignItems: 'center', marginTop: Spacing.lg,
    ...Shadows.base,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '800' },

  errorBox: {
    backgroundColor: '#FFE5E5', padding: Spacing.sm, borderRadius: Radii.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.statusExpired,
  },
  errorText: { color: Colors.statusExpired, fontSize: FontSizes.sm, fontWeight: '600' },
});
