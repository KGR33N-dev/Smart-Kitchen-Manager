import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { authApi, UserOut } from '../api/client';

const { height } = Dimensions.get('window');
type Mode = 'login' | 'register';

interface Props {
  onAuthenticated: (user: UserOut) => void;
}

// ─── Feature row used in header ───────────────────────────────────────────────
function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.featureRow}>
      <Text style={s.featureIcon}>{icon}</Text>
      <Text style={s.featureText}>{text}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) { setError('Wypełnij wszystkie pola'); return; }
    if (mode === 'register' && !fullName.trim()) { setError('Podaj imię i nazwisko'); return; }
    setLoading(true);
    try {
      const user = mode === 'login'
        ? await authApi.login(email.trim(), password)
        : await authApi.register(email.trim(), password, fullName.trim());
      onAuthenticated(user);
    } catch (e: any) {
      setError(e?.detail ?? (mode === 'login' ? 'Błędny email lub hasło' : 'Rejestracja nieudana'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Hero ── */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>🌿</Text>
          <Text style={s.heroTitle}>FreshTrack</Text>
          <Text style={s.heroTagline}>Inteligentna spiżarnia w twoich rękach</Text>
          <View style={s.features}>
            <Feature icon="🤖" text="AI analizuje twoje produkty" />
            <Feature icon="⏰" text="Alerty przed przeterminowaniem" />
            <Feature icon="♻️" text="Zero-Waste score w czasie rzeczywistym" />
          </View>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          {/* Tab switcher */}
          <View style={s.tabs}>
            {(['login', 'register'] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[s.tab, mode === m && s.tabActive]}
                onPress={() => { setMode(m); setError(null); }}
              >
                <Text style={[s.tabText, mode === m && s.tabTextActive]}>
                  {m === 'login' ? 'Zaloguj się' : 'Nowe konto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.cardTitle}>
            {mode === 'login' ? 'Witaj z powrotem 👋' : 'Stwórz konto 🚀'}
          </Text>
          <Text style={s.cardSub}>
            {mode === 'login'
              ? 'Zaloguj się aby zarządzać spiżarnią'
              : 'Dołącz i zacznij zarządzać jedzeniem lepiej'}
          </Text>

          {/* Full name (register only) */}
          {mode === 'register' && (
            <View style={s.field}>
              <Text style={s.label}>Imię i Nazwisko</Text>
              <View style={s.inputRow}>
                <Ionicons name="person-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={s.input}
                  placeholder="Jan Kowalski"
                  placeholderTextColor={Colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>
          )}

          {/* Email */}
          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputRow}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
              <TextInput
                style={s.input}
                placeholder="jan@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.field}>
            <Text style={s.label}>Hasło</Text>
            <View style={s.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder={mode === 'register' ? 'Min. 8 znaków' : '••••••••'}
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{ padding: 4 }}>
                <Ionicons
                  name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.statusExpired} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
                    size={18}
                    color={Colors.white}
                  />
                  <Text style={s.submitText}>
                    {mode === 'login' ? 'Zaloguj się' : 'Stwórz konto'}
                  </Text>
                </View>
              )
            }
          </TouchableOpacity>

          {/* Demo hint */}
          <View style={s.demoHint}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
            <Text style={s.demoText}>
              Brak konta? Zarejestruj się — to zajmuje 10 sekund.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primaryBg },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  hero: { alignItems: 'center', paddingTop: height * 0.07, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.xl },
  heroEmoji: { fontSize: 64 },
  heroTitle: { fontSize: FontSizes['2xl'] + 4, fontWeight: '900', color: Colors.primaryDark, marginTop: 8 },
  heroTagline: { fontSize: FontSizes.base, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  features: { marginTop: Spacing.md, gap: 8, alignSelf: 'stretch' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  featureText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },

  card: {
    backgroundColor: Colors.white, borderRadius: Radii.xl,
    marginHorizontal: Spacing.lg, padding: Spacing.xl,
    ...Shadows.strong,
  },

  tabs: {
    flexDirection: 'row', backgroundColor: Colors.primaryBg,
    borderRadius: Radii.lg, padding: 4, marginBottom: Spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: Radii.md, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.white, ...Shadows.card },
  tabText: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primaryDark, fontWeight: '800' },

  cardTitle: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary },
  cardSub: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },

  field: { marginBottom: Spacing.md },
  label: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: Radii.lg,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
  },
  input: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F0', borderRadius: Radii.md,
    padding: Spacing.sm, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.statusExpired + '30',
  },
  errorText: { fontSize: FontSizes.sm, color: Colors.statusExpired, fontWeight: '600', flex: 1 },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.lg,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
    marginTop: Spacing.sm, ...Shadows.card,
  },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: FontSizes.md },

  demoHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.md, justifyContent: 'center',
  },
  demoText: { fontSize: FontSizes.xs, color: Colors.textMuted, textAlign: 'center', flex: 1 },
});
