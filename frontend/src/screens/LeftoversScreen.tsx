import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  available: boolean;
}

interface Recipe {
  id: number;
  title: string;
  cookTimeMin: number;
  rating: number;
  hasAllIngredients: boolean;
  missingCount: number;
  ingredients: Ingredient[];
  imageUri: string;
}

// ─── Mock data (replace with API call) ────────────────────────────────────────

const MOCK_RECIPES: Recipe[] = [
  {
    id: 1,
    title: 'Leftover Vegetable Omelet',
    cookTimeMin: 15,
    rating: 4,
    hasAllIngredients: true,
    missingCount: 0,
    imageUri: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=600',
    ingredients: [
      { name: 'Eggs', quantity: 3, unit: 'pcs', available: true },
      { name: 'Broccoli', quantity: 100, unit: 'g', available: true },
      { name: 'Cheddar Cheese', quantity: 50, unit: 'g', available: true },
    ],
  },
  {
    id: 2,
    title: 'Quick Leftover Chicken Tacos',
    cookTimeMin: 10,
    rating: 4.5,
    hasAllIngredients: true,
    missingCount: 0,
    imageUri: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600',
    ingredients: [
      { name: 'Chicken Breast', quantity: 200, unit: 'g', available: true },
      { name: 'Cherry Tomatoes', quantity: 150, unit: 'g', available: true },
      { name: 'Tortillas', quantity: 4, unit: 'pcs', available: true },
    ],
  },
  {
    id: 3,
    title: 'Pantry Pasta Salad',
    cookTimeMin: 20,
    rating: 3.5,
    hasAllIngredients: false,
    missingCount: 1,
    imageUri: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=600',
    ingredients: [
      { name: 'Pasta', quantity: 200, unit: 'g', available: true },
      { name: 'Feta Cheese', quantity: 100, unit: 'g', available: false },
      { name: 'Carrots', quantity: 100, unit: 'g', available: true },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StarRating = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Ionicons
        key={i}
        name={i <= Math.floor(rating) ? 'star' : i - rating < 1 ? 'star-half' : 'star-outline'}
        size={14}
        color={Colors.accentYellow}
      />
    ))}
  </View>
);

const RecipeCard = ({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
    <Image source={{ uri: recipe.imageUri }} style={styles.cardImage} />
    <View style={styles.cardBody}>
      <Text style={styles.cardTitle}>{recipe.title}</Text>

      <View style={styles.cardBadgeRow}>
        <View
          style={[
            styles.badge,
            { backgroundColor: recipe.hasAllIngredients ? Colors.primaryBgMid : '#FFF3E0' },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: recipe.hasAllIngredients ? Colors.primaryDark : Colors.accentOrange },
            ]}
          >
            {recipe.hasAllIngredients
              ? '✅ You have all ingredients'
              : `⚠️ Missing ${recipe.missingCount} ingredient${recipe.missingCount > 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.cardMetaText}>Cook time: {recipe.cookTimeMin}m</Text>
        <View style={{ flex: 1 }} />
        <StarRating rating={recipe.rating} />
      </View>
    </View>
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LeftoversScreen({ navigation }: any) {
  const [recipes] = useState<Recipe[]>(MOCK_RECIPES);
  const [loading] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Cook with Leftovers</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing['2xl'] }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] }}
        >
          {recipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onPress={() => {}} // TODO: navigate to RecipeDetailScreen
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primaryBg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  title: { flex: 1, fontSize: FontSizes.xl, fontWeight: '800', color: Colors.textPrimary },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    marginBottom: Spacing.base,
    ...Shadows.card,
  },
  cardImage: { width: '100%', height: 180 },
  cardBody: { padding: Spacing.md, gap: Spacing.xs },
  cardTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },

  cardBadgeRow: { flexDirection: 'row' },
  badge: {
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { fontSize: FontSizes.xs + 1, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardMetaText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
});
