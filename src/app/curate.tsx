/**
 * Curating — the most disciplined screen in the app (spec §6, §11d). Full-screen
 * blind head-to-head: two photos, a hairline divider, nothing else. Served in
 * sets of 10 (natural stop after each), 50/day cap, blind forever (no names,
 * levels, or hearts). Picks fire optimistically and are spaced to respect the
 * server's 2s guard so none is ever lost. Pushed from Today — never a tab.
 */
import { useRouter } from 'expo-router';
import { Aperture } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { capture } from '@lib/analytics';
import { getConfig } from '@lib/config';
import { createVoteSender, fetchMatchupSet, type MatchupSet } from '@lib/matchup';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { EmptyState } from '@/components/molecules/EmptyState';
import { MatchupPair } from '@/components/molecules/MatchupPair';
import { ReportSheet } from '@/components/molecules/ReportSheet';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, space, typeScale } from '@/components/tokens';

type Phase = 'loading' | 'judging' | 'setDone' | 'capped' | 'empty' | 'error';

export default function CurateScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [set, setSet] = useState<MatchupSet | null>(null);
  const [idx, setIdx] = useState(0);
  const [sessionPicks, setSessionPicks] = useState(0); // picks across every set this session
  const [remaining, setRemaining] = useState(0);
  const [cap, setCap] = useState(50); // daily pick cap (config, never hardcoded)
  const [reportId, setReportId] = useState<string | null>(null); // photo being reported
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void getConfig('vote_cap').then(setCap);
  }, []);

  const senderRef = useRef<ReturnType<typeof createVoteSender> | null>(null);
  if (senderRef.current === null) {
    senderRef.current = createVoteSender(
      () => setPhase('capped'),
      (n) => setRemaining(n),
    );
  }

  const loadSet = useCallback(async () => {
    setPhase('loading');
    try {
      await senderRef.current?.drain(); // let prior picks land so pairs don't repeat
      const next = await fetchMatchupSet();
      setRemaining(next.remaining);
      if (next.capped) return setPhase('capped');
      if (next.pairs.length === 0) return setPhase('empty');
      setSet(next);
      setIdx(0);
      setPhase('judging');
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void loadSet();
  }, [loadSet]);

  const advance = useCallback((total: number) => {
    setIdx((prev) => {
      if (prev + 1 >= total) {
        setPhase('setDone');
        capture('curate_set_completed');
        return prev;
      }
      return prev + 1;
    });
  }, []);

  const onPick = (which: 'top' | 'bottom') => {
    if (!set || phase !== 'judging') return;
    const pair = set.pairs[idx];
    const winner = which === 'top' ? pair.aId : pair.bId;
    const loser = which === 'top' ? pair.bId : pair.aId;
    if (set.dropId) senderRef.current?.enqueue({ winner, loser, drop: set.dropId });
    setSessionPicks((n) => n + 1);
    setTimeout(() => advance(set.pairs.length), 260); // let the pick beat land first
  };

  const onSkip = () => {
    if (!set) return;
    advance(set.pairs.length);
  };

  const onReport = (which: 'top' | 'bottom') => {
    if (!set) return;
    const pair = set.pairs[idx];
    setReportId(which === 'top' ? pair.aId : pair.bId);
  };

  const onReported = () => {
    setReportId(null);
    setToast("Thanks. We'll take a look.");
    if (set) advance(set.pairs.length); // don't judge a pair you just flagged
  };

  const close = () => router.replace('/(tabs)/today');

  // ---- non-judging states -------------------------------------------------
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            loading shots…
          </Mono>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'capped') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.bigLine}>You’ve curated today’s {cap}</Text>
          <Text style={styles.subLine}>The gallery is in good hands. Come back tomorrow.</Text>
          <Button label="Back to Today" fullWidth onPress={close} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'empty') {
    // Two very different empties: you judged everything available (a real
    // completion, expected early when only a few shots exist), or nothing is
    // in yet. Reframe the first as done, not as a dead-end. `remaining < cap`
    // means you've voted on this drop before (even in an earlier session), so
    // "caught up" is right even when this session made no picks yet.
    const hasCurated = sessionPicks > 0 || remaining < cap;
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          {hasCurated ? (
            <>
              <Text style={styles.bigLine}>You’re all caught up</Text>
              <Text style={styles.subLine}>
                You’ve curated every shot in today’s round. More appear as people shoot.
              </Text>
              <Button label="Back to Today" fullWidth onPress={close} />
            </>
          ) : (
            <EmptyState
              icon={Aperture}
              line="No shots to curate yet. They roll in as people shoot today."
              ctaLabel="Back to Today"
              onCta={close}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <EmptyState icon={Aperture} line="Couldn’t load the shots" ctaLabel="Try again" onCta={() => void loadSet()} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'setDone') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.bigLine}>Set done</Text>
          <Text style={styles.subLine}>
            {sessionPicks} {sessionPicks === 1 ? 'shot' : 'shots'} curated so far
          </Text>
          {remaining > 0 ? (
            <>
              <Button label="Curate another set" fullWidth onPress={() => void loadSet()} />
              <Button label="Back to Today" variant="text" onPress={close} />
            </>
          ) : (
            <Button label="Back to Today" fullWidth onPress={close} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ---- judging ------------------------------------------------------------
  const pair = set!.pairs[idx];
  return (
    <View style={styles.root}>
      <Animated.View key={idx} entering={FadeIn.duration(150)} style={styles.pairWrap}>
        <MatchupPair
          topUri={pair.aUri ?? ''}
          bottomUri={pair.bUri ?? ''}
          index={idx + 1}
          total={set!.pairs.length}
          theme={set!.prompt}
          onPick={onPick}
          onSkip={onSkip}
          onReport={onReport}
          onClose={close}
        />
      </Animated.View>
      <ReportSheet visible={reportId !== null} submissionId={reportId} onClose={() => setReportId(null)} onReported={onReported} />
      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: space.gutter },
  pairWrap: { flex: 1 },
  bigLine: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
    textAlign: 'center',
  },
  subLine: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
  },
});
