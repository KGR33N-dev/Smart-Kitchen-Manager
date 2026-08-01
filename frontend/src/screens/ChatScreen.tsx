import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { ChatResponse, aiApi } from '../api/client';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  data?: ChatResponse;
}

const SUGGESTIONS = ['Chcę zrobić żeberka', 'Zróbmy spaghetti', 'Co mam w lodówce?', 'Naleśniki'];

export default function ChatScreen({ navigation, route }: any) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', text: 'Cześć! 👨‍🍳 Napisz co chcesz ugotować, a sprawdzę przepis, zajrzę do Twojej lodówki i dopiszę brakujące produkty do listy zakupów.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await aiApi.chat(msg);
      setMessages(m => [...m, { role: 'assistant', text: res.reply, data: res }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', text: e?.detail ?? 'Ups, coś poszło nie tak. Spróbuj ponownie.' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const prefill = route?.params?.prefill;
    if (prefill) {
      send(prefill);
      navigation.setParams({ prefill: undefined }); // consume so it doesn't re-fire
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.prefill]);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages, loading]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>🤖 Asystent</Text>
        <TouchableOpacity style={s.recipesBtn} onPress={() => navigation.navigate('Recipes')}>
          <Ionicons name="restaurant-outline" size={16} color={Colors.primaryDark} />
          <Text style={s.recipesBtnText}>Przepisy</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.messages}>
          {messages.map((m, i) => (
            <View key={i} style={[s.bubbleRow, m.role === 'user' ? s.rowRight : s.rowLeft]}>
              <View style={[s.bubble, m.role === 'user' ? s.userBubble : s.aiBubble]}>
                <Text style={[s.bubbleText, m.role === 'user' && s.userText]}>{m.text}</Text>

                {/* Extra actions on assistant recipe replies */}
                {m.data?.added_to_shopping && m.data.added_to_shopping.length > 0 && (
                  <TouchableOpacity style={s.actionChip} onPress={() => navigation.navigate('Shopping')}>
                    <Ionicons name="cart" size={14} color={Colors.white} />
                    <Text style={s.actionChipText}>
                      Dodano {m.data.added_to_shopping.length} do zakupów — zobacz
                    </Text>
                  </TouchableOpacity>
                )}
                {m.data?.recipe && (
                  <TouchableOpacity
                    style={s.linkChip}
                    onPress={() => navigation.navigate('Recipes', { recipeId: m.data!.recipe!.id })}
                  >
                    <Ionicons name="book-outline" size={14} color={Colors.primaryDark} />
                    <Text style={s.linkChipText}>Zobacz przepis: {m.data.recipe.name}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          {loading && (
            <View style={[s.bubbleRow, s.rowLeft]}>
              <View style={[s.bubble, s.aiBubble]}><ActivityIndicator color={Colors.primary} /></View>
            </View>
          )}
        </ScrollView>

        {/* Suggestions */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestions} contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.base }}>
          {SUGGESTIONS.map(sug => (
            <TouchableOpacity key={sug} style={s.suggChip} onPress={() => send(sug)}>
              <Text style={s.suggText}>{sug}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Napisz wiadomość…"
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity style={s.sendBtn} onPress={() => send()} disabled={loading}>
            <Ionicons name="send" size={20} color={Colors.white} />
          </TouchableOpacity>
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
  recipesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryBgMid, borderRadius: Radii.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  recipesBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.primaryDark },

  messages: { padding: Spacing.base, gap: Spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: Radii.lg, padding: Spacing.md, ...Shadows.card },
  aiBubble: { backgroundColor: Colors.white, borderTopLeftRadius: 4 },
  userBubble: { backgroundColor: Colors.primary, borderTopRightRadius: 4 },
  bubbleText: { fontSize: FontSizes.base, color: Colors.textPrimary, lineHeight: 21 },
  userText: { color: Colors.white },

  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: Colors.primaryDark, borderRadius: Radii.full, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start',
  },
  actionChipText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.xs },
  linkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: Colors.primaryBgMid, borderRadius: Radii.full, paddingHorizontal: 12, paddingVertical: 7,
  },
  linkChipText: { color: Colors.primaryDark, fontWeight: '700', fontSize: FontSizes.xs },

  suggestions: { maxHeight: 44, marginBottom: 4 },
  suggChip: {
    backgroundColor: Colors.white, borderRadius: Radii.full, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, justifyContent: 'center',
  },
  suggText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    padding: Spacing.sm, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radii.full,
    paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: FontSizes.base, color: Colors.textPrimary,
  },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radii.full, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
