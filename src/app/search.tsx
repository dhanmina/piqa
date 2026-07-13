import { useRouter } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { follow, unfollow } from '@lib/profile';
import { searchUsers, type SearchUser } from '@lib/search';
import { Avatar } from '@/components/atoms/Avatar';
import { displayFamily } from '@/components/fonts';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function UserRow({ user, onPress }: { user: SearchUser; onPress: () => void }) {
  const [isFollowing, setIsFollowing] = useState(user.is_following);
  const [followers, setFollowers] = useState(user.followers || 0);
  const [busy, setBusy] = useState(false);

  const onToggle = async () => {
    setBusy(true);
    const next = !isFollowing;
    setIsFollowing(next); // optimistic
    setFollowers((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    const ok = next ? await follow(user.id) : await unfollow(user.id);
    if (!ok) {
      // revert on failure
      setIsFollowing(!next);
      setFollowers((prev) => (!next ? prev + 1 : Math.max(0, prev - 1)));
    }
    setBusy(false);
  };

  return (
    <Pressable accessibilityRole="button" style={styles.userRow} onPress={onPress}>
      <Avatar username={user.username} uri={user.avatar_url} size={56} />
      <View style={styles.userInfo}>
        <Text style={styles.username} numberOfLines={1}>
          {user.username}
        </Text>
        <Text style={styles.userSub} numberOfLines={1}>
          {compact.format(followers)} followers · {compact.format(user.hearts || 0)} hearts
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
        disabled={busy}
        onPress={onToggle}
        style={[styles.followBtn, isFollowing && styles.followingBtn]}
      >
        <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await searchUsers(term);
      setResults(data);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const renderItem = ({ item }: { item: SearchUser }) => (
    <UserRow user={item} onPress={() => router.push({ pathname: '/u/[id]', params: { id: item.id } })} />
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <SearchIcon size={20} color={colors.paper60} strokeWidth={icons.strokeWidth} />
          <TextInput
            style={styles.input}
            placeholder="Search shooters..."
            placeholderTextColor={colors.paper30}
            selectionColor={colors.safelight}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearBtn}>
              <X size={16} color={colors.paper60} strokeWidth={icons.strokeWidth} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {loading && results.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.paper60} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.trim().length >= 2 && !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No shooters found</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink2,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    minHeight: space.target,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: typeScale.body,
    color: colors.paper,
    height: '100%',
  },
  clearBtn: { padding: 4 },
  cancelBtn: { minHeight: space.target, justifyContent: 'center' },
  cancelText: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  list: { padding: space.gutter, paddingBottom: 48 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  username: {
    fontFamily: displayFamily,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  userSub: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.safelight,
    borderWidth: 1,
    borderColor: colors.safelight,
    minWidth: 80,
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderColor: colors.paper30,
  },
  followBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.ink,
  },
  followingBtnText: {
    color: colors.paper,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: typeScale.body, color: colors.paper60 },
});
