/**
 * Today — a state machine, no sub-tabs (spec §11c). Three shapes:
 *   (a) no live drop  → WAITING: countdown to next drop + yesterday's Photo of the Day +
 *                        one "while you wait" action (curate or practice shot)
 *   (b) live, unsubmitted → ShotCard
 *   (c) submitted     → bracket-framed shot + queue status line
 * Empty is never absence: the waiting state is anticipation, per spec law.
 */
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, CloudOff, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPendingItemForDrop, retryBlocked, subscribeQueue, type QueueItem } from '@lib/services/captureQueue';
import { useActivityUnread } from '@lib/activity';
import { getConfig } from '@lib/services/config';
import { useFrameForDate } from '@lib/hooks/frames';
import { capture } from '@lib/services/analytics';
import { markResultSeen } from '@lib/services/gallery';
import { useSignedThumb } from '@lib/hooks/useCache';
import { useHomeState, useTodayHint, useTodayGolden, useShotCountToday, useFriendShotCountToday } from '@lib/homeState';
import { useLast7Pattern } from '@lib/streak';
import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { StreakFlame } from '@/components/atoms/StreakFlame';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { Sheet } from '@/components/molecules/Sheet';
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
  const hint = useTodayHint();
  const golden = useTodayGolden();
  const shotCount = useShotCountToday();
  const friendShotCount = useFriendShotCountToday();
  const activityUnread = useActivityUnread();
  const [toast, setToast] = useState<string | null>(null);
  const [showStreakInfo, setShowStreakInfo] = useState(false);
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
  const last7 = useLast7Pattern();
  const potd = data?.yesterday_potd ?? null;
  const lastResult = data?.last_result ?? null;
  const pending: QueueItem | undefined = drop ? getPendingItemForDrop(drop.id) : undefined;
  // The submitted daily is the hero print — show it full-res, not the 300px thumb
  // blown up (that read as blurry). The thumb rides along as an instant placeholder
  // so the print never blinks while the full-res decodes in behind it.
  const signedSubFull = useSignedThumb(!pending ? submission?.image_path : null);
  const signedSubThumb = useSignedThumb(!pending ? submission?.thumb_path : null);
  const signedPotdThumb = useSignedThumb(potd?.thumb_path);
  // A photo wears the frame of the day it was shot (event day → event frame, else
  // default) — never the viewer's equipped (profile) frame.
  const dropFrame = useFrameForDate(drop?.drops_at);
  const resultFrame = useFrameForDate(lastResult?.drop_date);
  const signedResultThumb = useSignedThumb(lastResult?.thumb_path);

  // Reading the result IS seeing it — clear Today's dot on focus, not on mount (the
  // tab can be mounted without ever being looked at). The gallery's reveal flag is
  // separate and survives this, so the confetti still waits for the gallery.
  const resultDropId = lastResult?.drop_id ?? null;
  useFocusEffect(
    useCallback(() => {
      if (resultDropId) {
        void markResultSeen(resultDropId);
        capture('result_seen');
      }
    }, [resultDropId]),
  );

  const submitted = Boolean(submission || pending);
  // The server returns a drop only while it's votable (now within
  // [drops_at, voting_closes_at) — the same bounds get_matchup uses), so the drop's
  // presence IS the "voting is open" signal. Re-deriving it from the device clock
  // (Date.now() vs voting_closes_at) only ever produced false negatives on clock
  // skew / stale cache, hiding the Curate action after a valid submission.
  const votingOpen = Boolean(drop);
  // The streaks table only updates at day-close, but a shot lights its dot live —
  // so a just-shot day would otherwise show filled dots beside a 0/unlit flame.
  // Reconcile: shooting today lights the flame (the dead→alive transition is
  // unconditional server-side, so "shot today but server dead" just means the
  // close hasn't run), and derive days-alive from the live window until it does.
  const shotToday = last7[6] === true;
  const serverAlive = streak?.is_alive ?? false;
  const flameAlive = serverAlive || shotToday;
  let streakDays = streak?.current_weeks ?? 0;
  if (!serverAlive && shotToday && last7.length === 7) {
    const first = last7.findIndex(Boolean); // earliest shot day in the 7-day window
    streakDays = first >= 0 ? 7 - first : 1; // calendar days since it lit
  }
  const brandNew = !flameAlive && !last7.some(Boolean);

  // Streak relight: brief flare + haptic when dead→alive transition fires.
  const [relighting, setRelighting] = useState(false);
  const prevAlive = useRef(flameAlive);
  useEffect(() => {
    if (!prevAlive.current && flameAlive) {
      setRelighting(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      capture('streak_relight');
      const t = setTimeout(() => setRelighting(false), 500);
      return () => clearTimeout(t);
    }
    prevAlive.current = flameAlive;
  }, [flameAlive]);

  // A quiet one-liner under the flame that teaches the 4-of-7 rhythm, then gets
  // out of the way after the first week. Short by design — the shield icon in the
  // flame already says "a miss is covered", so the caption doesn't repeat it.
  const streakCaption: string | null = brandNew
    ? 'Your first shot lights it'
    : !flameAlive
      ? 'Shoot today to relight it'
      : streakDays <= 7
        ? 'Shoot at least every other day'
        : null;
  const quickDrawUntil = drop
    ? new Date(Date.parse(drop.drops_at) + quickDrawMinutes * 60_000)
    : undefined;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Compact, single-line date (matches the gallery's mono date). The streak flame
  // is wide and can't shrink, so a long "Wed, Jul 16" would overflow and clip.
  const dateLine = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();

  // The "while you wait" action, shared by WAITING and DONE so they can't drift:
  // curate when a drop is votable, otherwise a practice shot. (These live here
  // because the tab bar deliberately can't reach curate or practice.)
  const whileYouWait = (
    <View style={styles.actionBlock}>
      <Mono size={typeScale.caption} color={colors.paper60}>
        WHILE YOU WAIT
      </Mono>
      {votingOpen && drop ? (
        <Button
          label="Curate today’s shots"
          variant="ghost"
          fullWidth
          onPress={() => router.push('/curate')}
        />
      ) : (
        <Button
          label="Take a free shot"
          variant="ghost"
          fullWidth
          onPress={() => router.push('/camera?practice=1')}
        />
      )}
    </View>
  );

  // Never hardcode the reveal hour: voting closes at 08:00 Asia/Manila and is swept
  // hourly, so a literal "9am" was both an hour late and wrong outside that region.
  // Derived from the drop, rendered in the viewer's own timezone.
  const resultsAt = drop ? clockTime(drop.voting_closes_at) : null;

  // The submitted print is the hero, but a full-bleed 3:4 print swallowed the column
  // and left the status + action crammed. Cap its height to ~a third of the screen so
  // the composition breathes; a centered print with margins also reads more like a
  // print than an edge-to-edge crop.
  const { width: winW, height: winH } = useWindowDimensions();
  const heroPrintW = Math.min(winW - space.gutter * 2, winH * 0.34);

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
    const inRound = Boolean(submission); // uploaded + entered — now waiting on results
    // The status line names the problem, the button names the fix — "Upload needs a
    // retry" sitting on top of a "Retry upload" button said the cure twice, the cause never.
    const statusLine = inRound
      ? votingOpen
        ? 'Shot submitted'
        : 'Curators are picking'
      : blocked
        ? 'Upload didn\'t go through'
        : queued
          ? 'Shot saved · will upload'
          : 'Shot saved · uploading';
    body = (
      <View style={styles.stateFill}>
        <View style={styles.submittedHero}>
          {/* The brackets stay: they are the focus-lock submit moment (spec §11d),
              not a status marker. Status is null here by definition — the day has
              not closed, so close_day has not ruled on this photo yet. */}
          <Brackets animated color={colors.paper}>
            <View>
              <FramedPhoto
                photoUri={pending?.originalUri ?? signedSubFull}
                placeholderUri={signedSubThumb}
                dayNumber={drop?.day_number ?? submission?.day_number ?? 0}
                frameId={dropFrame}
                status={submission?.status ?? null}
                width={heroPrintW}
              />
              {(queued || blocked) && (
                <View style={styles.queuedBadge}>
                  <RefreshCw size={11} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                  <Mono size={typeScale.tabLabel} color={colors.paper60}>
                    queued
                  </Mono>
                </View>
              )}
            </View>
          </Brackets>
          {/* One status unit: the shot's state, then when results land. No Quick Draw
              here — it's a past-tense reward for the result screen, and next to the
              live Quick Draw prompt it just read as "why is this still here?". */}
          <View style={styles.submittedStatus}>
            <Text style={styles.statusLine}>{statusLine}</Text>
            {inRound && resultsAt && <Text style={styles.subNote}>Results at {resultsAt}</Text>}
            {inRound && friendShotCount != null && friendShotCount > 0 ? (
              <Mono size={typeScale.caption} color={colors.paper40}>
                {friendShotCount} friend{friendShotCount !== 1 ? 's' : ''} already shot today
              </Mono>
            ) : inRound && shotCount != null && shotCount > 1 ? (
              <Mono size={typeScale.caption} color={colors.paper40}>
                {shotCount} shots today
              </Mono>
            ) : null}
            {inRound && resultsAt && (
              <Mono size={typeScale.caption} color={colors.paper40} style={styles.openLoop}>
                Tomorrow's subject drops at {clockTime(data?.next_drop_at ?? drop!.voting_closes_at)}
              </Mono>
            )}
          </View>
          {blocked && <Button label="Retry upload" variant="ghost" onPress={() => void retryBlocked()} fullWidth />}
        </View>
        {!blocked && votingOpen && (
          <View style={styles.submittedAction}>
            <Mono size={typeScale.caption} color={colors.paper60}>
              VOTING IS OPEN
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
            hint={hint}
            golden={golden}
            closesAt={drop.submit_closes_at}
            quickDrawUntil={quickDrawUntil}
            onShoot={() => router.push('/camera')}
          />
          {friendShotCount != null && friendShotCount > 0 ? (
            <Mono size={typeScale.caption} color={colors.paper40} style={styles.socialProof}>
              {friendShotCount} friend{friendShotCount !== 1 ? 's' : ''} already shot today
            </Mono>
          ) : shotCount != null && shotCount > 0 ? (
            <Mono size={typeScale.caption} color={colors.paper40} style={styles.socialProof}>
              {shotCount} photographer{shotCount !== 1 ? 's' : ''} shooting today
            </Mono>
          ) : null}
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
    // so its heart (reaction) count is 0. The meaningful signal is `votes`: the blind
    // curation picks it earned. Calling those "hearts" would tell someone whose shot
    // didn't place that a crowd saw it and loved it. Nobody saw it. Curators chose it.
    // It's also why only this branch carries a count: a non-gallery shot has no tile in the
    // gallery, so Today is the one surface that will ever tell them.
    const resultLine = lastResult.is_potd
      ? 'Photo of the Day'
      : lastResult.in_gallery
        ? 'In the gallery'
        : lastResult.votes > 0
          ? `Picked ${lastResult.votes} ${lastResult.votes === 1 ? 'time' : 'times'} by curators`
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
                frameId={resultFrame}
                status={lastResult.status}
              />
              <View style={styles.resultCaption}>
                <Text style={styles.resultLine}>{resultLine}</Text>
              </View>
            </Pressable>
          </View>

          <NextShot at={data?.next_drop_at} onDone={() => void refresh()} />
        </View>

        {/* No "See the gallery" button: the action block's job is the destinations the
            tab bar CAN'T reach (curate and practice have no tab, deliberately). The
            gallery has one — plus the print above is its door, and the Gallery tab
            wears the unseen-reveal dot. DONE is WAITING with a result, so it offers
            exactly what WAITING offers — curate while a drop is votable (a new round
            can be live while yesterday's result still shows), else a practice shot. */}
        {whileYouWait}
      </View>
    );
  } else {
    // (a) WAITING — anticipation, never absence.
    body = (
      <View style={styles.stateFill}>
        <View style={styles.waitingHero}>
          {potd && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View yesterday's gallery"
              onPress={() => router.push('/(tabs)/gallery')}
            >
              <Mono size={typeScale.caption} color={colors.paper60} style={styles.waitingLabel}>
                YESTERDAY'S WINNER
              </Mono>
              <View style={styles.potdSpacer} />
              <FramedPhoto
                photoUri={signedPotdThumb}
                dayNumber={potd.day_number}
                frameId="default"
                status={potd.status}
                width={heroPrintW}
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

          <NextShot at={data?.next_drop_at} onDone={() => void refresh()} />

          {whileYouWait}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How your streak works"
                hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                onPress={() => setShowStreakInfo(true)}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <StreakFlame
                  days={streakDays}
                  last7={last7}
                  alive={flameAlive}
                  shields={streak?.shields ?? 0}
                  relighting={relighting}
                />
              </Pressable>
              <Mono size={typeScale.caption} color={colors.paper60} numberOfLines={1}>
                {dateLine}
              </Mono>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Activity"
              hitSlop={10}
              onPress={() => router.push('/activity')}
              style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]}
            >
              <Bell size={22} strokeWidth={icons.strokeWidth} color={colors.paper60} />
              {/* Calm unread signal — the same safelight dot as the tab bar, never a count. */}
              {activityUnread && <View style={styles.bellDot} />}
            </Pressable>
          </View>
          {streakCaption && <Text style={styles.dayZero}>{streakCaption}</Text>}
          {last7.some(Boolean) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share your weekly recap"
              onPress={() => router.push('/weekly-recap')}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Mono size={typeScale.caption} color={colors.safelight}>
                Share your week
              </Mono>
            </Pressable>
          )}
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
      <Sheet visible={showStreakInfo} onClose={() => setShowStreakInfo(false)} title="Your streak">
        <View style={styles.streakInfo}>
          <Text style={styles.streakInfoLine}>
            Your flame stays lit as long as you never miss two days in a row. Shoot at least every other day and it keeps
            burning.
          </Text>
          <Text style={styles.streakInfoLine}>
            The seven dots are your last week, oldest to today (the ringed one). A filled dot is a day you shot; the number
            is how many days it has been lit.
          </Text>
          <Text style={styles.streakInfoLine}>
            A shield covers one slip, so a single missed pair of days won&apos;t put it out.
          </Text>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

/**
 * The forward clock, shared by WAITING and DONE. The eyebrow labels a duration, so
 * with no duration there is no eyebrow — otherwise it stutters ("NEXT SHOT IN" over
 * "Next shot drops soon", saying "next shot" twice). The fallback is deliberately
 * quiet rather than display-sized: it's a soft "soon", not a headline.
 */
/**
 * Humanized countdown. Shows a warm label that shifts with proximity:
 *  - > 1 h  →  "Drops at 7 PM"   (static — no ticking noise)
 *  - 1–60 m →  "in 14m 30s"      (ticking)
 *  - < 1 m  →  "Drops soon"       (static)
 */
function NextShot({ at, onDone }: { at?: string | null; onDone: () => void }) {
  if (!at) return <Text style={styles.softLine}>Next shot drops soon</Text>;

  const target = new Date(at).getTime();
  const msLeft = target - Date.now();

  // > 1 hour — show target time, no ticking
  if (msLeft > 3_600_000) {
    const targetDate = new Date(at);
    const timeStr = targetDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: targetDate.getMinutes() > 0 ? '2-digit' : undefined,
    });
    return <Text style={styles.dropTime}>Drops at {timeStr}</Text>;
  }

  // < 1 minute
  if (msLeft <= 0) return <Text style={styles.dropTime}>Drops soon</Text>;

  // 1 min – 60 min — ticking human format
  return <CountdownHuman until={at} onDone={onDone} />;
}

/** Ticking "in Xm Ss" countdown — used inside NextShot for the final hour. */
function CountdownHuman({ until, onDone }: { until: string; onDone: () => void }) {
  const target = new Date(until).getTime();
  const [msLeft, setMsLeft] = useState(() => target - Date.now());

  useEffect(() => {
    setMsLeft(target - Date.now());
    const id = setInterval(() => {
      const left = target - Date.now();
      setMsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        onDone();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onDone]);

  const total = Math.max(0, Math.floor(msLeft / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;

  return (
    <Mono weight="medium" size={typeScale.title} color={colors.paper}>
      {m > 0 ? `in ${m}m ${String(s).padStart(2, '0')}s` : 'Drops soon'}
    </Mono>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  streakInfo: { gap: 14 },
  streakInfoLine: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    lineHeight: typeScale.sub * 1.5,
    color: colors.paper60,
  },
  content: {
    padding: space.gutter,
    paddingBottom: space.gutter + space.shutter / 2,
    gap: space.gutter,
    flexGrow: 1,
  },
  header: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 32,
  },
  headerLeft: { gap: 6 },
  // Nudge the glyph down so it optically centers on the flame beside it.
  bell: { paddingTop: 2 },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.safelight,
  },
  dayZero: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
  socialProof: {
    textAlign: 'center',
    marginTop: 4,
  },
  openLoop: {
    marginTop: 8,
  },
  skeletonCard: {
    alignSelf: 'stretch',
    aspectRatio: frame.aspect, // every real state resolves to a print in this slot
    borderRadius: radius.card,
    backgroundColor: colors.ink2,
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
    gap: space.gutter + 8, // generous air between the print, its status, and the retry
  },
  waitingHero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.gutter,
  },
  submittedAction: {
    alignSelf: 'stretch',
    alignItems: 'center', // center the eyebrow onto the hero's axis; the fullWidth button still stretches
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
  // Status + results time read as one unit, tightly stacked and centered under the print.
  submittedStatus: { alignItems: 'center', gap: 6 },
  subNote: {
    textAlign: 'center',
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
    textAlign: 'center',
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
  dropTime: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
    paddingVertical: 4,
  },
  waitingLabel: {
    textAlign: 'center',
  },
  waitingSocial: {
    textAlign: 'center',
    paddingVertical: 2,
  },
  potdHearts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionBlock: {
    alignItems: 'center', // eyebrow centered onto the column; the fullWidth button still stretches
    gap: 10,
  },
  devLink: {
    alignItems: 'center',
    paddingTop: space.gutter,
    paddingBottom: 4,
  },
});
