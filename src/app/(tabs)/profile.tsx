/**
 * Own profile — a thin wrapper over the shared ProfileView. The gear pushes the
 * /settings route (frame, account, danger zone all live there now, not in a sheet).
 */
import { useRouter } from 'expo-router';

import { useProfile } from '@lib/profile';
import { ProfileView } from '@/components/ProfileView';

export default function ProfileScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useProfile(null);

  return (
    <ProfileView
      data={data}
      loading={loading}
      error={error}
      onRetry={() => void refresh()}
      onSettings={() => router.push('/settings')}
      onOpenFollowing={() => router.push('/following')}
    />
  );
}
