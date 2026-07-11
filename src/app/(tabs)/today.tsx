/**
 * Today — a state machine, no sub-tabs (spec §11c, v1 subset):
 *   no drop   → teaser + free-shooting invitation
 *   live      → ShotCard (prompt, mono countdown, the one Primary)
 *   submitted → bracket-framed shot + queue status line
 * The offline queue drives the status line: connectivity is NEVER an error.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { Aperture } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPendingItemForDrop, retryBlocked, subscribeQueue, type QueueItem } from '@lib/captureQueue';
import { useHomeState } from '@lib/homeState';
import { supabase } from '@lib/supabase';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { StreakFlame } from '@/components/atoms/StreakFlame';
import { Brackets } from '@/components/molecules/Brackets';
import { EmptyState } from '@/components/molecules/EmptyState';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { ShotCard } from '@/components/molecules/ShotCard';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, space, typeScale } from '@/components/tokens';

function useSignedThumb(path: string | null | undefined) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUri(null);
      return;
    }
    supabase.storage
      .from('submissions')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive && data) setUri(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return uri;
}

export default function TodayScreen() {
  const router = useRouter();
  const { data, loading, refresh } = useHomeState();
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setQueueTick] = useState(0);

  useEffect(
    () =>
      subscribeQueue((event) => {
        setQueueTick((t) => t + 1);
        if (event.type === 'blocked') {
          setToast('Upload hit a wall — tap Retry below');
        }
        if (event.type === 'duplicate') {
          setToast('Already submitted for today');
        }
        if (event.type === 'done' && event.item.kind === 'daily') {
          setToast('In the running ✓');
        }
      }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const drop = data?.drop ?? null;
  const submission = data?.submission ?? null;
  const streak = data?.streak ?? null;
  const pending: QueueItem | undefined = drop ? getPendingItemForDrop(drop.id) : undefined;
  const signedThumb = useSignedThumb(!pending ? submission?.thumb_path : null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const dateLine = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
  });

  let body: ReactElement;
  if (loading) {
    body = <View style={styles.skeletonCard} />;
  } else if (drop && (submission || pending)) {
    // SUBMITTED — bracket-framed shot; the print is the hero.
    const queued = pending?.lastErrorKind === 'network';
    const blocked = pending?.status === 'blocked';
    const statusLine = submission
      ? 'In the running ✓'
      : blocked
        ? 'Upload needs a retry'
        : queued
          ? 'Saved — will upload'
          : 'Shot saved ✓ — uploading';
    body = (
      <View style={styles.submittedWrap}>
        <Brackets color={colors.paper} style={styles.submittedBrackets}>
          <PhotoTile
            uri={pending?.originalUri ?? signedThumb}
            badge={queued || blocked ? 'queued' : undefined}
            aspectRatio={3 / 4}
          />
        </Brackets>
        <Text style={styles.statusLine}>{statusLine}</Text>
        {submission?.quick_draw && (
          <Mono size={typeScale.caption} color={colors.paper60}>
            ⚡ Quick Draw
          </Mono>
        )}
        {blocked && <Button label="Retry upload" variant="ghost" onPress={() => void retryBlocked()} />}
        {!blocked && drop.is_live && (
          <Text style={styles.subNote}>Curators are already picking — results at 9am</Text>
        )}
      </View>
    );
  } else if (drop?.is_live) {
    // LIVE — the loudest composition, the one Primary on this screen.
    body = (
      <ShotCard
        prompt={drop.prompt}
        closesAt={drop.submit_closes_at}
        onShoot={() => router.push('/camera')}
      />
    );
  } else {
    // NO DROP (or window closed without a submission) — invitation, not absence.
    body = (
      <View style={styles.teaserWrap}>
        <EmptyState
          icon={Aperture}
          line={
            drop
              ? 'Today’s window has closed — tomorrow’s Shot is coming'
              : 'Today’s Shot hasn’t dropped yet — the camera never closes'
          }
          ctaLabel="Free shooting"
          onCta={() => router.push('/camera')}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.paper60} />
        }
      >
        <View style={styles.header}>
          <StreakFlame
            weeks={streak?.current_weeks ?? 0}
            daysThisWeek={streak?.days_this_week ?? 0}
            alive={(streak?.current_weeks ?? 0) > 0 || (streak?.days_this_week ?? 0) > 0}
          />
          <Mono size={typeScale.caption} color={colors.paper60}>
            {dateLine}
          </Mono>
        </View>
        {body}
      </ScrollView>
      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: space.gutter,
    gap: space.gutter,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  skeletonCard: {
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.ink2,
  },
  submittedWrap: {
    alignItems: 'center',
    gap: 12,
  },
  submittedBrackets: {
    alignSelf: 'stretch',
  },
  statusLine: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  subNote: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  teaserWrap: {
    paddingTop: space.gutter * 2,
  },
});
