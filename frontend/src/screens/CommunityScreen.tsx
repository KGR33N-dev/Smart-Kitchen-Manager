import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, Radii, Shadows } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: number;
  author: string;
  avatarUri: string;
  title: string;
  body: string;
  images: string[];
  likes: number;
  comments: number;
  liked: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_POSTS: Post[] = [
  {
    id: 1,
    author: 'Sarah J.',
    avatarUri: 'https://i.pravatar.cc/100?img=5',
    title: "Sarah's Zucchini Fritters",
    body: "Sarah's Zucchini fritters involve some zucchini matters and most olionen and...",
    images: [
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300',
      'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=300',
      'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=300',
    ],
    likes: 128,
    comments: 2,
    liked: true,
  },
  {
    id: 2,
    author: 'Mike K.',
    avatarUri: 'https://i.pravatar.cc/100?img=12',
    title: "Sarah's Zucchini Fritters",
    body: "Sarah's Zucchini Fritters ands a fean nate ucuhe u stamp with clmen and more...",
    images: [
      'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=300',
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300',
      'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=300',
    ],
    likes: 128,
    comments: 1,
    liked: false,
  },
];

// ─── Post Card ────────────────────────────────────────────────────────────────

const PostCard = ({ post }: { post: Post }) => {
  const [liked, setLiked] = useState(post.liked);
  const [count, setCount] = useState(post.likes);

  const toggleLike = () => {
    setLiked(l => !l);
    setCount(c => (liked ? c - 1 : c + 1));
  };

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <Image source={{ uri: post.avatarUri }} style={styles.avatar} />
        <Text style={styles.authorName}>{post.author}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Post title */}
      <Text style={styles.postTitle}>{post.title}</Text>

      {/* Photo strip */}
      <View style={styles.photoStrip}>
        {post.images.slice(0, 3).map((uri, idx) => (
          <Image
            key={idx}
            source={{ uri }}
            style={[
              styles.stripPhoto,
              idx === 0 ? styles.stripFirst : styles.stripRest,
            ]}
          />
        ))}
      </View>

      {/* Body */}
      <Text style={styles.postBody} numberOfLines={2}>{post.body}</Text>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? Colors.accentRed : Colors.textSecondary}
          />
          <Text style={[styles.actionText, liked && { color: Colors.accentRed }]}>
            {count} likes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity>
          <Ionicons name="share-social-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const [posts] = useState<Post[]>(MOCK_POSTS);
  const [search, setSearch] = useState('');

  const filtered = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.author.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn}>
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.createBtnText}>Create Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={15} color={Colors.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => String(p.id)}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.base }} />}
      />
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
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  title: { flex: 1, fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBtn: { padding: 4 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    gap: 4,
  },
  createBtnText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '600' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadows.card,
  },
  searchInput: { flex: 1, fontSize: FontSizes.base, color: Colors.textPrimary },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    ...Shadows.card,
    gap: Spacing.sm,
  },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  authorName: { fontWeight: '700', fontSize: FontSizes.base, color: Colors.textPrimary },

  postTitle: { fontWeight: '700', fontSize: FontSizes.md, color: Colors.textPrimary },

  photoStrip: { flexDirection: 'row', gap: 4 },
  stripPhoto: { borderRadius: Radii.md },
  stripFirst: { width: '48%', aspectRatio: 1 },
  stripRest: { width: '24%', aspectRatio: 1 },

  postBody: { fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 19 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '600' },
});
