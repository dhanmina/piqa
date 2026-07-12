/**
 * Own profile — a thin wrapper over the shared ProfileView (same layout as any
 * other profile). Wins wall, starred row, level/frame/streak all come from
 * useProfile(null); the others' view lives at /u/[id].
 */
import { useRouter } from 'expo-router';

import { useProfile, type ProfileWin } from '@lib/profile';
import { supabase } from '@lib/supabase';
import { ProfileView } from '@/components/ProfileView';

export default function ProfileScreen() {
  const router = useRouter();
  const { data, loading } = useProfile(null);

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
      onSignOut={() => void supabase.auth.signOut()}
      onOpenWin={openWin}
    />
  );
}
