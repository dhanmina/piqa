/**
 * DEV time machine (spec §16) — watch shoot → vote → close → gallery in minutes.
 * Dev-only screen; every button hits a beta_mode-guarded RPC. Not a product
 * surface, so it ignores the one-accent-per-screen law like /dev/kit.
 *
 *   Force drop now  → current BETA drop goes live now, pristine (pre-vote)
 *   Seed votes      → house accounts vote (8–20 comparisons/photo, non-uniform)
 *   Run close-day   → BT fit → gallery flags → PotD → materialized blob
 *   Reset day       → clear votes + gallery flags to re-test
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  devAdvanceDay,
  devBreakStreak,
  devFillVoteCap,
  devForceComeback,
  devForceDrop,
  devGrantXp,
  devResetDay,
  devRunCloseDay,
  devSeedVotes,
  devStatus,
  type DevStatus,
} from '@lib/dev';
import { levelFromXp } from '@lib/xp';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { Toggle } from '@/components/atoms/Toggle';
import { displayFamily } from '@/components/fonts';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, space, typeScale } from '@/components/tokens';

type Action = 'force' | 'seed' | 'close' | 'reset' | 'advance' | 'xp' | 'break' | 'comeback' | 'fillcap';

export default function TimeMachine() {
  const router = useRouter();
  const [status, setStatus] = useState<DevStatus | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [iShot, setIShot] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setStatus(await devStatus());
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'status failed');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: Action, fn: () => Promise<Record<string, unknown>>, label: (r: Record<string, unknown>) => string) => {
    setBusy(action);
    try {
      const res = await fn();
      if (res.ok === false) setToast(`✗ ${res.reason ?? 'failed'}`);
      else setToast(label(res));
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const rows: [string, string | number | boolean | null | undefined][] = [
    ['drop date', status?.drop_date],
    ['status', status?.status],
    ['live / voting', status ? `${status.is_live ? 'live' : 'closed'} · ${status.voting_open ? 'voting' : 'shut'}` : null],
    ['submissions', status?.submissions],
    ['votes', status?.votes],
    ['in gallery', status?.in_gallery],
    ['closed', status?.closed ? 'yes' : 'no'],
    ['PotD', status?.potd_shooter ?? '—'],
    ['I shot today', status?.my_submitted == null ? null : status.my_submitted ? 'yes' : 'no'],
    ['my votes', status?.my_votes],
  ];

  const level = status?.my_xp == null ? null : levelFromXp(status.my_xp);
  const retentionRows: [string, string | number | boolean | null | undefined][] = [
    ['xp / level', status?.my_xp == null ? null : `${status.my_xp} · Lv ${level}`],
    ['streak weeks', status?.streak_weeks],
    ['days this week', status?.days_this_week],
    ['shields', status?.shields],
    ['comeback', status?.comeback_pending == null ? null : status.comeback_pending ? 'pending' : 'no'],
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Time Machine</Text>
        <Text style={styles.caption}>dev · beta only — a full daily cycle in minutes</Text>

        <View style={styles.statusCard}>
          {status?.drop_id == null ? (
            <Mono size={typeScale.caption} color={colors.paper60}>
              no BETA drop yet — Force drop to begin
            </Mono>
          ) : (
            rows.map(([k, v]) => (
              <View key={k} style={styles.statusRow}>
                <Mono size={typeScale.caption} color={colors.paper60}>
                  {k}
                </Mono>
                <Mono size={typeScale.caption} color={colors.paper}>
                  {v === undefined || v === null ? '—' : String(v)}
                </Mono>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionLabel}>ONE DAY CYCLE</Text>
        <View style={styles.actions}>
          <Button
            label="① Force drop now"
            fullWidth
            loading={busy === 'force'}
            onPress={() =>
              void run('force', devForceDrop, (r) => `Drop live · ${r.submissions ?? 0} submissions`)
            }
          />
          <Button
            label="② Seed votes"
            variant="ghost"
            fullWidth
            loading={busy === 'seed'}
            onPress={() =>
              void run('seed', devSeedVotes, (r) => `${r.votes ?? 0} votes · ${r.min_comparisons ?? 0}–${r.max_comparisons ?? 0} comps/photo`)
            }
          />
          <Button
            label="③ Run close-day now"
            variant="ghost"
            fullWidth
            loading={busy === 'close'}
            onPress={() =>
              void run('close', devRunCloseDay, (r) => `Closed · gallery ${r.gallery ?? 0} · PotD set`)
            }
          />
          <Button
            label="④ Reset day"
            variant="ghost"
            fullWidth
            loading={busy === 'reset'}
            onPress={() => void run('reset', devResetDay, () => 'Votes + gallery cleared')}
          />
        </View>

        <View style={styles.statusCard}>
          {retentionRows.map(([k, v]) => (
            <View key={k} style={styles.statusRow}>
              <Mono size={typeScale.caption} color={colors.paper60}>
                {k}
              </Mono>
              <Mono size={typeScale.caption} color={colors.paper}>
                {v === undefined || v === null ? '—' : String(v)}
              </Mono>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>RETENTION · SIMULATE A WEEK</Text>
        <View style={styles.actions}>
          <View style={styles.toggleRow}>
            <Toggle label="I shot today (counts toward streak)" value={iShot} onChange={setIShot} />
          </View>
          <Button
            label="⏭ Advance day"
            fullWidth
            loading={busy === 'advance'}
            onPress={() =>
              void run(
                'advance',
                () => devAdvanceDay(iShot),
                (r) => `Day ${r.drop_date ?? ''} live · I ${r.i_submitted ? 'shot' : 'skipped'}`,
              )
            }
          />
          <Button
            label="Grant +200 XP"
            variant="ghost"
            fullWidth
            loading={busy === 'xp'}
            onPress={() => void run('xp', () => devGrantXp(200), (r) => `XP now ${r.xp ?? 0}`)}
          />
          <Button
            label="Trigger streak break"
            variant="ghost"
            fullWidth
            loading={busy === 'break'}
            onPress={() => void run('break', devBreakStreak, () => 'Streak broken · shield spent')}
          />
          <Button
            label="Force comeback state"
            variant="ghost"
            fullWidth
            loading={busy === 'comeback'}
            onPress={() => void run('comeback', devForceComeback, () => 'Comeback armed · next shot pays double')}
          />
          <Button
            label="Fill vote cap"
            variant="ghost"
            fullWidth
            loading={busy === 'fillcap'}
            onPress={() => void run('fillcap', devFillVoteCap, (r) => `My votes ${r.my_votes ?? 0} / ${r.cap ?? 50}`)}
          />
        </View>

        <View style={styles.links}>
          <Button label="Refresh status" variant="text" onPress={() => void refresh()} />
          <Button label="Darkroom Kit →" variant="text" onPress={() => router.push('/dev/kit')} />
          <Button label="Back to app" variant="text" onPress={() => router.replace('/(tabs)/today')} />
        </View>
      </ScrollView>
      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: space.gutter },
  h1: { fontFamily: displayFamily, fontSize: typeScale.display, color: colors.paper },
  caption: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  statusCard: {
    backgroundColor: colors.ink2,
    borderRadius: 12,
    padding: space.gutter,
    gap: 8,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper60,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  actions: { gap: 12 },
  toggleRow: { paddingBottom: 2 },
  links: { gap: 4, alignItems: 'flex-start', paddingTop: 8 },
});
