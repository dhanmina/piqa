/**
 * Weekly recap — a shareable 4:5 poster summarizing the last 7 days.
 * Launched from the Today screen. The card is rendered off-screen and
 * snapshotted with react-native-view-shot for the OS share sheet.
 */
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { View as ViewType } from 'react-native';

import { useSignedThumb } from '@lib/hooks/useCache';
import { useSession } from '@lib/session';
import { useWeeklyRecap } from '@lib/hooks/useWeeklyRecap';
import { shareRecap } from '@lib/utils/share';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { WeeklyRecapCard } from '@/components/molecules/WeeklyRecapCard';
import { colors, space, typeScale } from '@/components/tokens';

export default function WeeklyRecapScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { recap, loading } = useWeeklyRecap();
  const { width: winW } = useWindowDimensions();
  const cardRef = useRef<ViewType>(null);
  const [sharing, setSharing] = useState(false);

  const shooter = session?.user?.user_metadata?.username ?? session?.user?.email?.split('@')[0] ?? 'photographer';
  const bestShotPath = recap?.best_shot?.thumb_path;
  const signedThumb = useSignedThumb(bestShotPath);

  const cardW = Math.min(winW - space.gutter * 2, 380);

  const onShare = useCallback(async () => {
    setSharing(true);
    try {
      await shareRecap(cardRef);
    } finally {
      setSharing(false);
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Mono size={typeScale.sub} color={colors.paper60}>Loading your week...</Mono>
        </View>
      </SafeAreaView>
    );
  }

  if (!recap || recap.shot_count === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Mono size={typeScale.body} color={colors.paper60}>No prints this week</Mono>
          <Mono size={typeScale.caption} color={colors.paper40} style={styles.emptyHint}>
            Shoot when you&apos;re ready
          </Mono>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

    return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <WeeklyRecapCard
          ref={cardRef}
          recap={recap}
          photoUri={signedThumb}
          shooter={shooter}
          width={cardW}
        />

        <Mono size={typeScale.caption} color={colors.paper40} style={styles.hint}>
          Drag the photo to reposition
        </Mono>

        <View style={styles.actions}>
          <Button
            label={sharing ? 'Sharing...' : 'Share your week'}
            variant="primary"
            fullWidth
            onPress={onShare}
            disabled={sharing}
          />
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Mono size={typeScale.caption} color={colors.paper60}>Back</Mono>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.gutter,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyHint: {
    marginTop: -4,
  },
  hint: {
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
