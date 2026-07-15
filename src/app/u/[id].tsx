/**
 * Another user's profile (spec §11c — same layout as own). Follow / unfollow;
 * counts stay hidden. ⋯ → block (mutual invisibility, spec §9).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';

import { blockUser } from '@lib/moderation';
import { follow, unfollow, useProfile, type ProfileWin } from '@lib/profile';
import { ProfileView } from '@/components/ProfileView';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, typeScale } from '@/components/tokens';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refresh } = useProfile(id ?? null);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const onFollowToggle = async () => {
    if (!data) return;
    setBusy(true);
    if (data.isFollowing) await unfollow(data.id);
    else await follow(data.id);
    await refresh();
    setBusy(false);
  };

  const onBlock = async () => {
    if (!data) return;
    setShowMenu(false);
    await blockUser(data.id);
    router.back(); // they vanish from my surfaces, and I from theirs
  };

  const openWin = (w: ProfileWin, username: string) => {
    router.push({
      pathname: '/photo/[id]',
      params: {
        id: w.id,
        path: w.thumbPath ?? '',
        shooter: username,
        potd: w.isPotd ? '1' : '',
        user: data?.id ?? '',
        day: String(w.dayNumber),
        status: w.status ?? '',
        frame: data?.equippedFrame ?? 'default',
      },
    });
  };

  return (
    <>
      <ProfileView
        data={data}
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        onBack={() => router.back()}
        onMore={data && !data.isSelf ? () => setShowMenu(true) : undefined}
        onFollowToggle={() => void onFollowToggle()}
        onOpenWin={openWin}
        followBusy={busy}
      />
      <Sheet visible={showMenu} onClose={() => setShowMenu(false)} title={data ? `@${data.username}` : undefined}>
        <Pressable accessibilityRole="button" style={styles.row} onPress={() => void onBlock()}>
          <Text style={styles.block}>Block this shooter</Text>
        </Pressable>
        <Text style={styles.note}>Blocking hides each of you from the other, everywhere.</Text>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12 },
  block: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.heart },
  note: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
});
