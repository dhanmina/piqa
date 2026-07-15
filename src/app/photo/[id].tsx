/**
 * /photo/[id] — thin route wrapper around PhotoDetailView (the shared view). Kept
 * for deep links and the profile/other-user win entries; the gallery now renders
 * the same view in-place as a modal (no route) — see src/components/PhotoDetailView.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PhotoDetailView } from '@/components/PhotoDetailView';

export default function PhotoDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    path?: string;
    shooter?: string;
    hearts?: string;
    user?: string;
    day?: string;
    status?: string;
    frame?: string;
  }>();

  return (
    <PhotoDetailView
      id={params.id}
      path={params.path}
      shooter={params.shooter}
      hearts={Number(params.hearts ?? 0)}
      userId={params.user}
      day={Number(params.day ?? 0)}
      status={params.status}
      frame={params.frame}
      onClose={() => router.back()}
    />
  );
}
