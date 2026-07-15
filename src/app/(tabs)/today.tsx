/**
 * Today — a state machine, no sub-tabs (spec §11c). Three shapes:
 *   (a) no live drop  → WAITING: countdown to next drop + yesterday's winner +
 *                        one "while you wait" action (curate or practice shot)
 *   (b) live, unsubmitted → ShotCard
 *   (c) submitted     → bracket-framed shot + queue status line
 * Empty is never absence: the waiting state is anticipation, per spec law.
 */
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { CloudOff, RefreshCw, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPendingItemForDrop, retryBlocked, subscribeQueue, type QueueItem } from '@lib/captureQueue';
import { getConfig } from '@lib/config';
import { markResultSeen, useSignedThumb } from '@lib/gallery';
import { useHomeState } from '@lib/homeState';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { StreakFlame } from '@/components/atoms/StreakFlame';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { ShotCard } from '@/components/molecules/ShotCard';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, frame, icons, overlay, radius, space, typeScale } from '@/components/tokens';

/** "8 AM" — drops the minutes when they're zero, so the common case reads as speech. */
const clockTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    ...(d.getMinutes() ? { minute: '2-digit' as const } : {}),
  });
};

export default function TodayScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useHomeState();
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
              : // No "Tap Retry below": the toast sits at the bottom, the Retry button
                // is in the centred hero above it, and the hero already names the fix.
                'Upload hit a wall',
          );
        if (event.type === 'duplicate') setToast('Already submitted for today');
        if (event.type === 'done' && event.item.kind === 'daily') {
          // Focus-lock submit moment (spec §11d): brackets snap + medium haptic. No toast —
          // the hero's status line already says "In the running" at the same instant.
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  // Reading the result IS seeing it — clear Today's dot on focus, not on mount (the
  // tab can be mounted without ever being looked at). The gallery's reveal flag is
  // separate and survives this, so the confetti still waits for the gallery.
  const resultDropId = lastResult?.drop_id ?? null;
  useFocusEffect(
    useCallback(() => {
      if (resultDropId) void markResultSeen(resultDropId);
    }, [resultDropId]),
  );

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

  // Never hardcode the reveal hour: voting closes at 08:00 Asia/Manila and is swept
  // hourly, so a literal "9am" was both an hour late and wrong outside that region.
  // Derived from the drop, rendered in the viewer's own timezone.
  const resultsAt = drop ? clockTime(drop.voting_closes_at) : null;

  let body: ReactElement;
  if (error && !data) {
    // Couldn't load with nothing cached → recoverable, not an endless skeleton.
    body = (
      <View style={styles.stateFill}>
        <View style={styles.centerFill}>
          <EmptyState
            icon={CloudOff}
            line="Couldn't load Today. Check your connection."
            ctaLabel="Retry"
            onCta={() => void refresh()}
          />
        </View>
      </View>
    );
  } else if (loading) {
    // Centred and photo-shaped: every real state resolves to a hero in this slot, so a
    // top-pinned 220px box guaranteed a jump the moment data landed.
    body = (
      <View style={styles.stateFill}>
        <View style={styles.centerFill}>
          <View style={styles.skeletonCard} />
        </View>
      </View>
    );
  } else if (submitted) {
    // (c) SUBMITTED — the print is the hero; status comes from the queue.
    const queued = pending?.lastErrorKind === 'network';
    const blocked = pending?.status === 'blocked';
    // The status line names the problem, the button names the fix — "Upload needs a
    // retry" sitting on top of a "Retry upload" button said the cure twice, the cause never.
    const statusLine = submission
      ? 'In the running'
      : blocked
        ? 'Upload didn’t go through'
        : queued
          ? 'Shot saved · will upload'
          : 'Shot saved · uploading';
    body = (
      <View style={styles.stateFill}>
        <View style={styles.submittedHero}>
          {/* The brackets stay: they are the focus-lock submit moment (spec §11d),
              not a status marker. Status is null here by definition — the day has
              not closed, so close_day has not ruled on this photo yet. */}
          <Brackets animated color={colors.paper} style={styles.stretch}>
            <View>
              <FramedPhoto
                photoUri={pending?.originalUri ?? signedSubThumb}
                dayNumber={drop?.day_number ?? submission?.day_number ?? 0}
                frameId={data?.equipped_frame ?? 'default'}
                status={submission?.status ?? null}
              />
              {(queued || blocked) && (
                <View style={styles.queuedBadge}>
                  <RefreshCw size={11} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                  <Mono size={10} color={colors.paper60}>
                    queued
                  </Mono>
                </View>
              )}
            </View>
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
          {!blocked && drop?.is_live && resultsAt && (
            <Text style={styles.subNote}>Curators are already picking · results at {resultsAt}</Text>
          )}
        </View>
        {!blocked && votingOpen && (
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
        {votingOpen && (
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
    // No numbers here, deliberately: this is a teaser, not a report. The gallery
    // owns "how much" (hearts on your tile), Profile owns standing (level/XP bar),
    // the streak flame already rewards showing up. A bare XP tick would only teach
    // a picks→XP model the award formula doesn't honour (flat bonuses, daily cap).
    // All four are labels, not sentences: the YOUR RESULT eyebrow already establishes
    // possession, so "Your shot earned…" said "your" twice — and mixing labels with
    // second-person prose gave the two BEST outcomes the coldest copy. One register.
    //
    // "Picked", not "hearts", and no "worldwide". This branch only ever fires for a shot
    // that did NOT make the gallery — which means nobody could ever see it to react to it,
    // so its reaction_count is 0 forever and `hearts` (votes + reactions) is exactly
    // vote_count: blind curation picks. Calling those "hearts" would tell someone whose
    // shot didn't place that a crowd saw it and loved it. Nobody saw it. Curators chose it.
    // It's also why only this branch carries a count: a non-gallery shot has no tile in the
    // gallery, so Today is the one surface that will ever tell them.
    const resultLine = lastResult.is_potd
      ? 'Photo of the Day'
      : lastResult.in_gallery
        ? 'In the gallery'
        : lastResult.hearts > 0
          ? `Picked ${lastResult.hearts} ${lastResult.hearts === 1 ? 'time' : 'times'} by curators`
          : 'Safe in your archive';
    body = (
      <View style={styles.stateFill}>
        <View style={styles.waitingHero}>
          <View style={styles.doneResult}>
            <Mono size={typeScale.caption} color={colors.paper60}>
              YOUR RESULT
            </Mono>
            {/* The print is the door into the gallery — same affordance as the PotD tile below. */}
            {/* No gold brackets and no crown icon: the print already carries the
                crown in its status slot, and the caption already says the words.
                Three ways of saying "you won" is two too many. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See today's gallery"
              style={styles.resultPress}
              onPress={() => router.push('/(tabs)/gallery')}
            >
              <FramedPhoto
                photoUri={signedResultThumb}
                dayNumber={lastResult.day_number}
                frameId={data?.equipped_frame ?? 'default'}
                status={lastResult.status}
              />
              <View style={styles.resultCaption}>
                <Text style={styles.resultLine}>{resultLine}</Text>
              </View>
            </Pressable>
          </View>

          <NextShot at={data?.next_drop_at} size={typeScale.title} onDone={() => void refresh()} />
        </View>

        {/* No "See the gallery" button: the action block's job is the destinations the
            tab bar CAN'T reach (curate and practice have no tab, deliberately). The
            gallery has one — plus the print above is its door, and the Gallery tab
            wears the unseen-reveal dot. DONE is WAITING with a result, so it offers
            what WAITING offers once voting has closed. */}
        <View style={styles.actionBlock}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            WHILE YOU WAIT
          </Mono>
          <Button
            label="Take a practice shot"
            variant="ghost"
            fullWidth
            onPress={() => router.push('/camera?practice=1')}
          />
        </View>
      </View>
    );
  } else {
    // (a) WAITING — anticipation, never absence.
    body = (
      <View style={styles.stateFill}>
        <View style={styles.waitingHero}>
          <NextShot at={data?.next_drop_at} size={typeScale.display} onDone={() => void refresh()} />

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
              {/* The winner wears their own frame and their own crown — the tile
                  needs no gold brackets and no second crown to say so. */}
              <FramedPhoto
                photoUri={signedPotdThumb}
                dayNumber={potd.day_number}
                frameId={potd.equipped_frame}
                status={potd.status}
              />
              <View style={styles.potdCaption}>
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

/**
 * The forward clock, shared by WAITING and DONE. The eyebrow labels a duration, so
 * with no duration there is no eyebrow — otherwise it stutters ("NEXT SHOT IN" over
 * "Next shot drops soon", saying "next shot" twice). The fallback is deliberately
 * quiet rather than display-sized: it's a soft "soon", not a headline.
 */
function NextShot({ at, size, onDone }: { at?: string | null; size: number; onDone: () => void }) {
  return (
    <View style={styles.countdownBlock}>
      {at ? (
        <>
          <Mono size={typeScale.caption} color={colors.paper60}>
            NEXT SHOT IN
          </Mono>
          <Countdown until={at} size={size} onDone={onDone} />
        </>
      ) : (
        <Text style={styles.softLine}>Next shot drops soon</Text>
      )}
    </View>
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
    alignSelf: 'stretch',
    aspectRatio: frame.aspect, // every real state resolves to a print in this slot
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
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  // Offline is first-class: the queued mark sits inside the photo window (never on
  // the rail), so a shot waiting to upload still reads as a print, not an error.
  queuedBadge: {
    position: 'absolute',
    top: '6%',
    left: '8%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: overlay.badge,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  quickDraw: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  subNote: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  doneResult: {
    gap: 10,
  },
  resultPress: {
    gap: 10, // keeps the tile → caption → hearts rhythm now that they share one tap target
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
    color: colors.paper60,
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
