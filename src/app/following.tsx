/**
 * /following — the accounts you follow, as a full screen (not a sheet): the list
 * can be long, and tapping through to a profile must return HERE on back, which a
 * dismissed sheet can't do. Same shape as /search. No counts (spec §9).
 */
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchFollowing, unfollow, type FollowedUser } from '@lib/profile';
import { Button } from '@/components/atoms/Button';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { UserRow } from '@/components/molecules/UserRow';
import { colors, radius, space } from '@/components/tokens';

function RowSkeleton() {
  return (
    <View style={styles.skelRow}>
      <View style={styles.skelAvatar} />
      <View style={styles.skelBar} />
    </View>
  );
}

export default function FollowingScreen() {
  const router = useRouter();
  const [list, setList] = useState<FollowedUser[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchFollowing().then((r) => {
      if (alive) setList(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onUnfollow = (id: string) => {
    setList((cur) => cur?.filter((u) => u.id !== id) ?? cur); // optimistic
    void unfollow(id); // background; a failure reappears on next visit
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Following" />

      {list === null ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon={Users} line="You're not following anyone yet. Follow shooters from the gallery." />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <UserRow
              username={item.username}
              avatarUri={item.avatar_url}
              onPress={() => router.push({ pathname: '/u/[id]', params: { id: item.id } })}
              trailing={<Button label="Following" variant="ghost" compact onPress={() => onUnfollow(item.id)} />}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  list: { paddingHorizontal: space.gutter, paddingTop: 8, gap: 4 },
  center: { flex: 1, justifyContent: 'center' },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  skelAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.ink2 },
  skelBar: { flex: 1, height: 12, borderRadius: radius.card / 3, backgroundColor: colors.ink2 },
});
