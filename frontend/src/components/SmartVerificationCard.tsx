/**
 * SmartVerificationCard — Daily Check swipeable card with react-native-reanimated
 *
 * UX: Swipe RIGHT = TAK (keep) ✅  |  Swipe LEFT = NIE (discard) ❌
 *     Tap buttons below for explicit selection.
 *     Card fades+exits when decision is made.
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';
import { FoodItem } from '../api/client';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.35;
const CARD_WIDTH = width - Spacing.base * 2;

interface Props {
  item: FoodItem;
  onConfirm: (item: FoodItem) => void;   // TAK
  onReject: (item: FoodItem) => void;    // NIE
  onSkip: (item: FoodItem) => void;
  index: number;
  totalCount: number;
}

const EMOJI_MAP: Record<string, string> = {
  Dairy: '🥛', Vegetables: '🥦', Fruit: '🍓',
  Meat: '🍗', Bakery: '🍞', Drinks: '🧃',
};

export default function SmartVerificationCard({
  item, onConfirm, onReject, onSkip, index, totalCount,
}: Props) {
  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardScale = useSharedValue(1);

  /* ─ Compute expiry display ─────────────────────────────────────────────── */
  const daysLeft = item.expiry_date
    ? differenceInDays(parseISO(item.expiry_date), new Date())
    : null;
  const expiryColor =
    daysLeft === null ? Colors.textMuted
    : daysLeft < 0 ? Colors.statusExpired
    : daysLeft <= 2 ? Colors.accentOrange
    : Colors.accentYellow;

  const expiryLabel =
    daysLeft === null ? 'No expiry'
    : daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago`
    : daysLeft === 0 ? 'Expires TODAY 🔴'
    : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

  /* ─ Dismiss helper ─────────────────────────────────────────────────────── */
  const dismiss = useCallback(
    (direction: 'left' | 'right', callback: () => void) => {
      const toX = direction === 'right' ? width * 1.2 : -width * 1.2;
      translateX.value = withTiming(toX, { duration: 300 });
      cardOpacity.value = withTiming(0, { duration: 280 }, () => {
        runOnJS(callback)();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ─ Gesture handler ────────────────────────────────────────────────────── */
  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number }>({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      cardScale.value = withSpring(0.97);
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
    },
    onEnd: (event) => {
      cardScale.value = withSpring(1);
      if (event.translationX > SWIPE_THRESHOLD) {
        runOnJS(dismiss)('right', () => onConfirm(item));
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        runOnJS(dismiss)('left', () => onReject(item));
      } else {
        // Snap back
        translateX.value = withSpring(0);
      }
    },
  });

  /* ─ Animated styles ────────────────────────────────────────────────────── */
  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate}deg` },
        { scale: cardScale.value },
      ],
      opacity: cardOpacity.value,
    };
  });

  // TAK badge (appears when swiping right)
  const takBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.6], [0, 1], Extrapolation.CLAMP),
  }));

  // NIE badge (appears when swiping left)
  const nieBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD * 0.6, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const emoji = EMOJI_MAP[item.category?.name ?? ''] ?? '🍽️';

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={[styles.card, cardStyle]}>

        {/* ── Swipe indicator badges ── */}
        <Animated.View style={[styles.badge, styles.takBadge, takBadgeStyle]}>
          <Text style={styles.badgeText}>✅ TAK</Text>
        </Animated.View>
        <Animated.View style={[styles.badge, styles.nieBadge, nieBadgeStyle]}>
          <Text style={styles.badgeText}>❌ NIE</Text>
        </Animated.View>

        {/* ── Hero image ── */}
        <Image
          source={{ uri: item.image_url ?? 'https://images.unsplash.com/photo-1601497565065-4fe62a9a3456?w=600' }}
          style={styles.heroImage}
          resizeMode="cover"
        />

        {/* ── Info ── */}
        <View style={styles.body}>
          {/* Category tag */}
          <View style={styles.catTag}>
            <Text style={styles.catEmoji}>{emoji}</Text>
            <Text style={styles.catName}>{item.category?.name ?? 'Uncategorised'}</Text>
          </View>

          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>

          {/* Quantity + location */}
          <View style={styles.metaRow}>
            <Ionicons name="scale-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.quantity} {item.unit}</Text>
            <Text style={styles.dot}>·</Text>
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.location}</Text>
          </View>

          {/* Expiry */}
          <View style={[styles.expiryBox, { backgroundColor: expiryColor + '22' }]}>
            <Ionicons name="calendar-outline" size={15} color={expiryColor} />
            <Text style={[styles.expiryLabel, { color: expiryColor }]}>{expiryLabel}</Text>
            {item.expiry_date && (
              <Text style={[styles.expiryDate, { color: expiryColor }]}>
                ({format(parseISO(item.expiry_date), 'MMM d')})
              </Text>
            )}
          </View>

          {/* AI confidence */}
          {item.ai_confidence !== null && item.ai_confidence !== undefined && (
            <View style={styles.aiRow}>
              <Ionicons name="sparkles-outline" size={13} color={Colors.primaryDark} />
              <Text style={styles.aiText}>
                AI Confidence {Math.round((item.ai_confidence ?? 0) * 100)}%
              </Text>
            </View>
          )}

          {/* Swipe hint */}
          <Text style={styles.swipeHint}>← Swipe to decide · or use buttons below →</Text>
        </View>

        {/* ── Decision buttons ── */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.noBtn]}
            onPress={() => dismiss('left', () => onReject(item))}
          >
            <Ionicons name="close" size={26} color={Colors.white} />
            <Text style={styles.btnLabel}>NIE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={() => onSkip(item)}>
            <Text style={styles.skipText}>Pomiń</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.yesBtn]}
            onPress={() => dismiss('right', () => onConfirm(item))}
          >
            <Ionicons name="checkmark" size={26} color={Colors.white} />
            <Text style={styles.btnLabel}>TAK</Text>
          </TouchableOpacity>
        </View>

        {/* ── Counter ── */}
        <Text style={styles.counter}>{index + 1} / {totalCount}</Text>
      </Animated.View>
    </PanGestureHandler>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    ...Shadows.strong,
    alignSelf: 'center',
  },

  badge: {
    position: 'absolute',
    top: 28,
    zIndex: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.lg,
    borderWidth: 3,
  },
  takBadge: {
    right: 20,
    backgroundColor: Colors.primary + 'DD',
    borderColor: Colors.primaryDark,
    transform: [{ rotate: '15deg' }],
  },
  nieBadge: {
    left: 20,
    backgroundColor: Colors.statusExpired + 'DD',
    borderColor: Colors.accentRed,
    transform: [{ rotate: '-15deg' }],
  },
  badgeText: { color: Colors.white, fontWeight: '900', fontSize: FontSizes.lg },

  heroImage: { width: '100%', height: 220 },

  body: { padding: Spacing.lg, gap: Spacing.sm },

  catTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  catEmoji: { fontSize: 16 },
  catName: { fontSize: FontSizes.xs + 1, fontWeight: '700', color: Colors.primaryDark },

  itemName: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.textPrimary },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  dot: { color: Colors.textMuted, fontSize: FontSizes.sm },

  expiryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    gap: 6,
  },
  expiryLabel: { fontWeight: '700', fontSize: FontSizes.base },
  expiryDate: { fontSize: FontSizes.sm },

  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aiText: { fontSize: FontSizes.sm, color: Colors.primaryDark, fontStyle: 'italic' },

  swipeHint: {
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.base,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  noBtn: { backgroundColor: Colors.statusExpired },
  yesBtn: { backgroundColor: Colors.primary },
  btnLabel: { color: Colors.white, fontWeight: '900', fontSize: FontSizes.xs + 1, marginTop: 2 },
  skipBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.full,
  },
  skipText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSizes.sm },

  counter: {
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    paddingBottom: Spacing.md,
  },
});
