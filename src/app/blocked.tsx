/**
 * /blocked — the accounts you've blocked, as a full screen (not a sheet): the list
 * can grow, and tapping a name through to a profile must return HERE on back. Mirror
 * of /following. Block is mutual invisibility (spec §9); this is the one place to
 * undo it, so a mistaken block is never permanent.
 */
import { useRouter } from 'expo-router';
import { UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBlocked, unblockUser, type BlockedUser } from '@lib/moderation';
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

export default function BlockedScreen() {
  const router = useRouter();
  const [list, setList] = useState<BlockedUser[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchBlocked().then((r) => {
      if (alive) setList(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onUnblock = (id: string) => {
    setList((cur) => cur?.filter((u) => u.id !== id) ?? cur); // optimistic
    void unblockUser(id); // background; a failure reappears on next visit
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Blocked accounts" />

      {list === null ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <RowSkeleton key={i} />
          ))}
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <EmptyState icon={UserX} line="You haven't blocked anyone. Blocking hides each of you from the other, everywhere." />
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
              trailing={<Button label="Unblock" variant="ghost" compact onPress={() => onUnblock(item.id)} />}
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
