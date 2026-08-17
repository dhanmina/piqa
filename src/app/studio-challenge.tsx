/**
 * /studio-challenge — the Studio's optional, non-competitive side-theme
 * (docs/build-steps.md §2C, docs/feature-research.md §4b). Hearts only, no
 * winner: the grid is ALWAYS chronological (server order) — never resorted by
 * heart count, which would read as a ranking. Fully isolated from the daily
 * Subject/gallery — see the fairness-law comment in
 * supabase/migrations/20260731000001_studio_challenges.sql.
 */
import { useRouter } from 'expo-router';
import { Camera as CameraIcon, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signThumbs } from '@lib/cache';
import { useSession } from '@lib/session';
import { useStudioChallenge } from '@lib/hooks/studioChallenges';
import { capture } from '@lib/services/analytics';
import { formatChallengeTimeLeft, toggleStudioChallengeHeart } from '@lib/services/studioChallenges';
import { Button } from '@/components/atoms/Button';
import { HeartButton } from '@/components/atoms/HeartButton';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, frame, space, typeScale } from '@/components/tokens';

export default function StudioChallengeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const myId = session?.user.id;
  const { data: challenge, loading, refresh } = useStudioChallenge();
  const [thumbUris, setThumbUris] = useState<Record<string, string>>({});
  const [gridWidth, setGridWidth] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const cellWidth = gridWidth > 0 ? Math.floor((gridWidth - space.gridGap) / 2) : undefined;
  const cellStyle = [styles.cell, cellWidth ? { width: cellWidth } : null];

  useEffect(() => {
    const paths = (challenge?.submissions ?? []).map((s) => s.thumbPath);
    if (paths.length === 0) return;
    let alive = true;
    void signThumbs(paths).then((m) => {
      if (alive) setThumbUris((prev) => ({ ...prev, ...Object.fromEntries(m) }));
    });
    return () => {
      alive = false;
    };
  }, [challenge?.submissions]);

  const onHeart = (submissionId: string) => {
    void toggleStudioChallengeHeart(submissionId).then((res) => {
      if (res.ok) capture('studio_challenge_hearted');
      else if (res.reason !== 'no_self_heart') setToast('Could not update — check your connection');
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Studio challenge" />

      {!challenge ? (
        !loading && (
          <View style={styles.emptyBody}>
            <EmptyState icon={Users} line="No challenge running right now." />
          </View>
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl tintColor={colors.paper60} refreshing={false} onRefresh={() => void refresh()} />}
        >
          <View style={styles.themeBlock}>
            <Text style={styles.theme}>{challenge.theme}</Text>
            <Text style={styles.meta}>{formatChallengeTimeLeft(challenge.endsAt)}</Text>
          </View>

          {challenge.isActive && !challenge.mySubmissionId && (
            <Button
              label="Add your photo"
              fullWidth
              onPress={() =>
                router.push({
                  pathname: '/camera',
                  params: { studioChallengeId: challenge.challengeId, studioTheme: challenge.theme },
                })
              }
            />
          )}

          {challenge.submissions.length === 0 ? (
            <View style={styles.emptyGrid}>
              <CameraIcon size={28} strokeWidth={1.5} color={colors.paper30} />
              <Text style={styles.emptyLine}>No photos yet — be the first.</Text>
            </View>
          ) : (
            <View
              style={styles.grid}
              onLayout={(e: LayoutChangeEvent) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && w !== gridWidth) setGridWidth(w);
              }}
            >
              {challenge.submissions.map((s) => (
                <View key={s.id} style={cellStyle}>
                  <PhotoTile uri={thumbUris[s.thumbPath]} aspectRatio={frame.aspect} />
                  <View style={styles.tileCaption}>
                    <Mono size={typeScale.caption} color={colors.paper60} numberOfLines={1} style={styles.tileName}>
                      {s.username}
                    </Mono>
                    <HeartButton
                      liked={s.heartedByMe}
                      count={s.heartCount > 0 ? s.heartCount : undefined}
                      readOnly={s.userId === myId}
                      onToggle={() => onHeart(s.id)}
                      size={16}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: 16 },
  emptyBody: { flex: 1, justifyContent: 'center' },
  themeBlock: { gap: 4 },
  theme: { fontFamily: fonts.sansSemiBold, fontSize: typeScale.title, color: colors.paper },
  meta: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  emptyGrid: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.gridGap },
  cell: {},
  tileCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.xxsPlus,
    paddingBottom: space.hair,
  },
  tileName: { flex: 1, marginRight: 8 },
});
