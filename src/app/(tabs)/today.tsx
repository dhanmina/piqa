/**
 * Today — a state machine, no sub-tabs (spec §11c). Three shapes:
 *   (a) no live drop  → WAITING: countdown to next drop + yesterday's winner +
 *                        one "while you wait" action (curate or practice shot)
 *   (b) live, unsubmitted → ShotCard
 *   (c) submitted     → bracket-framed shot + queue status line
 * Empty is never absence: the waiting state is anticipation, per spec law.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Crown, Zap } from 'lucide-react-native';
import { useEffect, useState, type ReactElement } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPendingItemForDrop, retryBlocked, subscribeQueue, type QueueItem } from '@lib/captureQueue';
import { getConfig } from '@lib/config';
import { useSignedThumb } from '@lib/gallery';
import { useHomeState } from '@lib/homeState';
import { levelFromXp } from '@lib/xp';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { StreakFlame } from '@/components/atoms/StreakFlame';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { ShotCard } from '@/components/molecules/ShotCard';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, icons, photo, radius, space, typeScale } from '@/components/tokens';

export default function TodayScreen() {
  const router = useRouter();
  const { data, loading, refresh } = useHomeState();
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setQueueTick] = useState(0);
  const [quickDrawMinutes, setQuickDrawMinutes] = useState(30);

  useEffect(() => {
    void getConfig('quick_draw_minutes').then(setQuickDrawMinutes);
  }, []);

  useEffect(
    () =>
      subscribeQueue((event) => {
        setQueueTick((t) => t + 1);
        if (event.type === 'blocked')
          setToast(
            event.item.lastErrorKind === 'rejected'
              ? (event.item.lastError ?? 'Shot not accepted')
              : 'Upload hit a wall. Tap Retry below',
          );
        if (event.type === 'duplicate') setToast('Already submitted for today');
        if (event.type === 'done' && event.item.kind === 'daily') {
          // Focus-lock submit moment (spec §11d): brackets snap + medium haptic + "In the running".
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setToast('In the running');
        }
      }),
    [],
  );

  const drop = data?.drop ?? null;
  const submission = data?.submission ?? null;
  const streak = data?.streak ?? null;
  const potd = data?.yesterday_potd ?? null;
  const lastResult = data?.last_result ?? null;
  const pending: QueueItem | undefined = drop ? getPendingItemForDrop(drop.id) : undefined;
  const signedSubThumb = useSignedThumb(!pending ? submission?.thumb_path : null);
  const signedPotdThumb = useSignedThumb(potd?.thumb_path);
  const signedResultThumb = useSignedThumb(lastResult?.thumb_path);
  const level = levelFromXp(data?.xp ?? 0);

  const submitted = Boolean(submission || pending);
  const votingOpen = Boolean(drop) && Date.now() < Date.parse(drop!.voting_closes_at);
  const brandNew = (streak?.current_weeks ?? 0) === 0 && (streak?.days_this_week ?? 0) === 0;
  const quickDrawUntil = drop
    ? new Date(Date.parse(drop.drops_at) + quickDrawMinutes * 60_000)
    : undefined;

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
  } else if (submitted) {
    // (c) SUBMITTED — the print is the hero; status comes from the queue.
    const queued = pending?.lastErrorKind === 'network';
    const blocked = pending?.status === 'blocked';
    const statusLine = submission
      ? 'In the running'
      : blocked
        ? 'Upload needs a retry'
        : queued
          ? 'Saved, will upload'
          : 'Shot saved · uploading';
    body = (
      <View style={styles.stateFill}>
        <View style={styles.submittedHero}>
          <Brackets animated color={colors.paper} style={styles.stretch}>
            <PhotoTile
              uri={pending?.originalUri ?? signedSubThumb}
              badge={queued || blocked ? 'queued' : undefined}
              aspectRatio={photo.aspect}
            />
          </Brackets>
          <Text style={styles.statusLine}>{statusLine}</Text>
          {submission?.quick_draw && (
            <View style={styles.quickDraw}>
              <Zap size={13} strokeWidth={icons.strokeWidth} color={colors.paper60} />
              <Mono size={typeScale.caption} color={colors.paper60}>
                Quick Draw
              </Mono>
            </View>
          )}
          {blocked && <Button label="Retry upload" variant="ghost" onPress={() => void retryBlocked()} fullWidth />}
          {!blocked && drop?.is_live && (
            <Text style={styles.subNote}>Curators are already picking · results at 9am</Text>
          )}
        </View>
        {!blocked && votingOpen && drop && (
          <View style={styles.submittedAction}>
            <Mono size={typeScale.caption} color={colors.paper60}>
              KEEP THE DAY GOING
            </Mono>
            <Button
              label="Curate today’s shots"
              variant="ghost"
              fullWidth
              onPress={() => router.push('/curate')}
            />
          </View>
        )}
      </View>
    );
  } else if (drop?.is_live) {
    // (b) LIVE — Shoot stays the single loud Primary; curating is a quiet second.
    body = (
      <View style={styles.stateFill}>
        <View style={styles.liveHero}>
          <ShotCard
            prompt={drop.prompt}
            closesAt={drop.submit_closes_at}
            quickDrawUntil={quickDrawUntil}
            onShoot={() => router.push('/camera')}
          />
        </View>
        {votingOpen && drop && (
          <View style={styles.submittedAction}>
            <Mono size={typeScale.caption} color={colors.paper60}>
              WHILE IT’S LIVE
            </Mono>
            <Button
              label="Curate today’s shots"
              variant="ghost"
              fullWidth
              onPress={() => router.push('/curate')}
            />
          </View>
        )}
      </View>
    );
  } else if (lastResult) {
    // (d) DONE / reveal-ready — the closed day's personal result, then teaser.
    // Losses are never shown: a non-gallery shot is framed as picks earned.
    const resultLine = lastResult.is_potd
      ? 'Photo of the Day'
      : lastResult.in_gallery
        ? 'In the gallery'
        : lastResult.hearts > 0
          ? `Your shot was picked ${lastResult.hearts} times by curators worldwide`
          : 'Your shot is safe in your archive';
    body = (
      <View style={styles.waitingWrap}>
        <View style={styles.doneResult}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            YOUR RESULT
          </Mono>
          <Brackets color={lastResult.is_potd ? colors.crown : colors.paper} style={styles.stretch}>
            <PhotoTile uri={signedResultThumb} aspectRatio={photo.aspect} />
          </Brackets>
          <View style={styles.resultCaption}>
            {lastResult.is_potd && (
              <Crown size={16} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />
            )}
            <Text style={styles.resultLine}>{resultLine}</Text>
          </View>
          <View style={styles.potdHearts}>
            <HeartGlyph size={13} color={colors.paper60} />
            <Mono size={typeScale.caption} color={colors.paper60}>
              {lastResult.hearts}
            </Mono>
            {lastResult.xp_awarded > 0 && (
              <>
                <Mono size={typeScale.caption} color={colors.paper30}>
                  ·
                </Mono>
                <Mono size={typeScale.caption} color={colors.safelight}>
                  +{lastResult.xp_awarded} XP · Lv {level}
                </Mono>
              </>
            )}
          </View>
          <Button label="See the gallery" fullWidth onPress={() => router.push('/(tabs)/gallery')} />
        </View>

        <View style={styles.countdownBlock}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            NEXT SHOT IN
          </Mono>
          {data?.next_drop_at ? (
            <Countdown until={data.next_drop_at} size={typeScale.title} onDone={() => void refresh()} />
          ) : (
            <Text style={styles.softLine}>Next shot drops soon</Text>
          )}
        </View>
      </View>
    );
  } else {
    // (a) WAITING — anticipation, never absence.
    body = (
      <View style={styles.stateFill}>
        <View style={styles.waitingHero}>
          <View style={styles.countdownBlock}>
            <Mono size={typeScale.caption} color={colors.paper60}>
              NEXT SHOT IN
            </Mono>
            {data?.next_drop_at ? (
              <Countdown until={data.next_drop_at} size={typeScale.display} onDone={() => void refresh()} />
            ) : (
              <Text style={styles.softLine}>Next shot drops soon</Text>
            )}
          </View>

          {potd && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View yesterday's winning gallery"
              onPress={() => router.push('/(tabs)/gallery')}
            >
              <Mono size={typeScale.caption} color={colors.paper60}>
                YESTERDAY’S WINNER
              </Mono>
              <View style={styles.potdSpacer} />
              <Brackets color={colors.crown} style={styles.stretch}>
                <PhotoTile uri={signedPotdThumb} aspectRatio={photo.aspect} />
              </Brackets>
              <View style={styles.potdCaption}>
                <Crown size={16} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />
                <Text style={styles.shooter}>{potd.shooter}</Text>
                <View style={styles.potdHearts}>
                  <HeartGlyph size={13} color={colors.paper60} />
                  <Mono size={typeScale.caption} color={colors.paper60}>
                    {potd.hearts}
                  </Mono>
                </View>
              </View>
            </Pressable>
          )}
        </View>

        <View style={styles.actionBlock}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            WHILE YOU WAIT
          </Mono>
          {votingOpen && drop ? (
            <Button
              label="Curate today’s shots"
              variant="ghost"
              onPress={() => router.push('/curate')}
              fullWidth
            />
          ) : (
            <Button
              label="Take a practice shot"
              variant="ghost"
              onPress={() => router.push('/camera?practice=1')}
              fullWidth
            />
          )}
        </View>
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
          <View style={styles.headerLeft}>
            <StreakFlame
              weeks={streak?.current_weeks ?? 0}
              daysThisWeek={streak?.days_this_week ?? 0}
              alive={streak?.is_alive ?? false}
              shields={streak?.shields ?? 0}
            />
            {brandNew && <Text style={styles.dayZero}>Day 0 · your first shot starts it</Text>}
          </View>
          <Mono size={typeScale.caption} color={colors.paper60}>
            {dateLine}
          </Mono>
        </View>
        {body}
        {__DEV__ && (
          <Pressable
            accessibilityRole="button"
            style={styles.devLink}
            onPress={() => router.push('/dev/time-machine')}
          >
            <Mono size={typeScale.caption} color={colors.paper30}>
              dev · time machine
            </Mono>
          </Pressable>
        )}
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
    flexGrow: 1, // fill the viewport so states can center their hero + drop the action into the thumb zone
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  headerLeft: {
    gap: 6,
  },
  dayZero: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  skeletonCard: {
    height: 220,
    borderRadius: radius.card,
    backgroundColor: colors.ink2,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  // Three-zone layout: header pinned top, hero optically centered, contextual
  // action pinned into the thumb zone. Used by live / waiting / submitted.
  stateFill: {
    flex: 1,
  },
  liveHero: {
    flex: 1,
    justifyContent: 'center',
  },
  submittedHero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  waitingHero: {
    flex: 1,
    justifyContent: 'center',
    gap: space.gutter * 1.5,
  },
  submittedAction: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 4,
  },
  statusLine: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  quickDraw: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  subNote: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  waitingWrap: {
    gap: space.gutter * 1.5,
  },
  doneResult: {
    gap: 10,
  },
  resultCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 4,
  },
  resultLine: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
    textAlign: 'center',
  },
  countdownBlock: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.gutter,
  },
  softLine: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
  },
  potdSpacer: {
    height: 8,
  },
  potdCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  shooter: {
    fontFamily: displayFamily,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  potdHearts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionBlock: {
    gap: 10,
  },
  devLink: {
    alignItems: 'center',
    paddingTop: space.gutter,
    paddingBottom: 4,
  },
});
