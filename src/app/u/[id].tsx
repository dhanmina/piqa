/**
 * Another user's profile (spec §11c — same layout as own). Follow / unfollow;
 * counts stay hidden. Report/block (⋯) lands with Step 8 safety.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { follow, unfollow, useProfile, type ProfileWin } from '@lib/profile';
import { ProfileView } from '@/components/ProfileView';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, refresh } = useProfile(id ?? null);
  const [busy, setBusy] = useState(false);

  const onFollowToggle = async () => {
    if (!data) return;
    setBusy(true);
    if (data.isFollowing) await unfollow(data.id);
    else await follow(data.id);
    await refresh();
    setBusy(false);
  };

  const openWin = (w: ProfileWin, username: string) => {
    router.push({
      pathname: '/photo/[id]',
      params: { id: w.id, path: w.thumbPath ?? '', shooter: username, potd: w.isPotd ? '1' : '' },
    });
  };

  return (
    <ProfileView
      data={data}
      loading={loading}
      onBack={() => router.back()}
      onFollowToggle={() => void onFollowToggle()}
      onOpenWin={openWin}
      followBusy={busy}
    />
  );
}
