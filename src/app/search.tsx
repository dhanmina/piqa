import { useRouter } from 'expo-router';
import { ChevronLeft, Search as SearchIcon, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { plural } from '@lib/format';
import { follow, unfollow } from '@lib/profile';
import { searchUsers, type SearchUser } from '@lib/search';
import { useSession } from '@lib/session';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { displayFamily } from '@/components/fonts';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function UserRow({ user, isSelf, onPress }: { user: SearchUser; isSelf: boolean; onPress: () => void }) {
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
          {compact.format(followers)} {plural(followers, 'follower')} · {compact.format(user.hearts || 0)}{' '}
          {plural(user.hearts || 0, 'heart')}
        </Text>
      </View>
      {isSelf ? (
        <Mono size={typeScale.caption} weight="medium" color={colors.paper60}>
          YOU
        </Mono>
      ) : (
        <Button
          label={isFollowing ? 'Following' : 'Follow'}
          variant={isFollowing ? 'ghost' : 'primary'}
          compact
          loading={busy}
          onPress={() => void onToggle()}
        />
      )}
    </Pressable>
  );
}

// Same silhouette as UserRow (avatar + two lines) in the app's ink2 skeleton
// idiom, so the wait matches the gallery/profile loaders, not an OS spinner.
function RowSkeleton() {
  return (
    <View style={styles.userRow}>
      <View style={styles.skelAvatar} />
      <View style={styles.skelInfo}>
        <View style={[styles.skelBar, styles.skelBarName]} />
        <View style={[styles.skelBar, styles.skelBarSub]} />
      </View>
    </View>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const { session } = useSession();
  const myId = session?.user.id;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await searchUsers(term);
      if (active) {
        setResults(data);
        setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const renderItem = ({ item }: { item: SearchUser }) => (
    <UserRow user={item} isSelf={item.id === myId} onPress={() => router.push({ pathname: '/u/[id]', params: { id: item.id } })} />
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => router.back()} />
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
      </View>

      {query.trim().length < 2 ? (
        <View style={styles.center}>
          <EmptyState icon={SearchIcon} line="Search shooters by username" />
        </View>
      ) : loading && results.length === 0 ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No shooters match “{query.trim()}”</Text>
              </View>
            )
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
    gap: 8,
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
  skelAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink2 },
  skelInfo: { flex: 1, gap: 8 },
  skelBar: { height: 12, borderRadius: 4, backgroundColor: colors.ink2 },
  skelBarName: { width: 120 },
  skelBarSub: { width: 180, height: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { paddingTop: 48, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: typeScale.body, color: colors.paper60 },
});
