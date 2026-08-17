/**
 * Studios — full tab per the 2026-07 IA review (docs/design-review/05, 07):
 * "the strongest D7/D30 lever" gets tab-level prominence, not a Profile row or a
 * Gallery segment. Reads off the SAME global gallery everyone else's photo lives
 * in — no Studio-only vote, ever. The Standing card is an anonymous aggregate
 * ("N of M made today's gallery"), never a ranked list of members (the same
 * fairness law that governs the main gallery). Ships dark-launched behind the
 * `studios_enabled` config flag; false shows the same empty-state copy already
 * designed for the tab, so the spot is held honestly rather than faked.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getConfig } from '@lib/services/config';
import { capture } from '@lib/services/analytics';
import { studioInviteUrl } from '@lib/utils/share';
import { useStudio } from '@lib/hooks/studios';
import { useStudioChallenge } from '@lib/hooks/studioChallenges';
import { createStudio, joinStudioByCode } from '@lib/services/studios';
import {
  fetchThemePresets,
  nudgeStudioDirector,
  formatChallengeTimeLeft,
  startStudioChallenge,
  STUDIO_CHALLENGE_DURATIONS,
} from '@lib/services/studioChallenges';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

const PILE_MAX = 3;

function MemberPile({ faces, total }: { faces: { id: string; username: string; avatarUrl: string | null; submittedToday: boolean }[]; total: number }) {
  const shown = faces.slice(0, PILE_MAX);
  const overflow = total - shown.length;
  return (
    <View style={styles.pile}>
      {shown.map((f, i) => (
        <View key={f.id} style={[i > 0 && { marginLeft: -11 }, { zIndex: shown.length - i }]}>
          <Avatar uri={f.avatarUrl} username={f.username} size={32} ringColor={colors.ink} ringWidth={2} />
          {f.submittedToday && (
            <View style={styles.presenceDot} accessibilityLabel={`${f.username} shot today`} />
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.overflowBadge, { marginLeft: -11 }]}>
          <Mono size={typeScale.caption} color={colors.paper60}>+{overflow}</Mono>
        </View>
      )}
    </View>
  );
}

function CreateJoinSheet({
  visible,
  onClose,
  initialMode = 'create',
  initialCode = '',
}: {
  visible: boolean;
  onClose: () => void;
  /** Seeds the sheet on a Studio-invite deep link (?code=...), so the recipient
   *  lands straight on a prefilled join screen instead of typing the code. */
  initialMode?: 'create' | 'join';
  initialCode?: string;
}) {
  const [mode, setMode] = useState<'create' | 'join'>(initialMode);
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed from props on every open, not just first mount — the parent tab
  // screen stays mounted once visited, so a second deep link with a new code
  // wouldn't otherwise reach an already-instantiated sheet's initial state.
  /* eslint-disable react-hooks/set-state-in-effect -- syncing to a prop
     transition (visible flipping true), not new async work */
  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setCode(initialCode);
  }, [visible, initialMode, initialCode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset happens on the way out (not via an effect keyed on `visible`) — the
  // sheet stays mounted through its own close animation, so clearing fields
  // eagerly here is simpler than syncing state to a prop transition.
  const close = () => {
    setMode('create');
    setName('');
    setCode('');
    setError(null);
    onClose();
  };

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    if (mode === 'create') {
      const res = await createStudio(name.trim());
      setBusy(false);
      if (res.ok) {
        capture('studio_created');
        close();
      } else {
        setError(res.reason === 'bad_name' ? 'Give your Studio a name (2–40 characters).' : 'Could not create your Studio.');
      }
    } else {
      const res = await joinStudioByCode(code.trim());
      setBusy(false);
      if (res.ok) {
        capture('studio_joined');
        close();
      } else {
        setError(
          res.reason === 'not_found'
            ? 'That code doesn’t match a Studio.'
            : res.reason === 'full'
              ? 'That Studio is full.'
              : 'Could not join that Studio.',
        );
      }
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="New Studio">
      <View style={styles.seg}>
        {(['create', 'join'] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m }}
            style={[styles.segItem, mode === m && styles.segItemOn]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.segLabel, mode === m && styles.segLabelOn]}>
              {m === 'create' ? 'Create new' : 'I have a code'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'create' ? (
        <Field
          label="Studio name"
          placeholder="Golden Hour Collective"
          value={name}
          onChangeText={setName}
          maxLength={40}
          hint={error ?? undefined}
          error={!!error}
        />
      ) : (
        <Field
          label="Invite code"
          placeholder="7F K9 Q2"
          mono
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
          maxLength={8}
          hint={error ?? undefined}
          error={!!error}
        />
      )}

      <Button
        label={mode === 'create' ? 'Create Studio' : 'Join Studio'}
        fullWidth
        loading={busy}
        disabled={mode === 'create' ? name.trim().length < 2 : code.trim().length < 6}
        onPress={() => void onSubmit()}
      />
    </Sheet>
  );
}

function InviteSheet({ visible, onClose, code, name }: { visible: boolean; onClose: () => void; code: string; name: string }) {
  const spaced = code.match(/.{1,2}/g)?.join(' ') ?? code;
  return (
    <Sheet visible={visible} onClose={onClose} title="Invite to Studio">
      <Text style={styles.inviteLine}>
        Your friend sees your Studio’s shared progress. It never affects anyone’s photos or votes.
      </Text>
      <View style={styles.codeBox}>
        <Mono size={typeScale.display} weight="semibold" color={colors.paper}>
          {spaced}
        </Mono>
      </View>
      <Button
        label="Share invite"
        fullWidth
        onPress={() => {
          void Share.share({
            message: `Join my Studio "${name}" on piqa: ${studioInviteUrl(code)}\n\nOr enter code ${code} in the Studios tab.`,
          });
          capture('studio_invite_shared');
        }}
      />
    </Sheet>
  );
}

function StartChallengeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [theme, setTheme] = useState('');
  const [duration, setDuration] = useState<(typeof STUDIO_CHALLENGE_DURATIONS)[number]['hours']>(72);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    void fetchThemePresets().then(setPresets);
  }, [visible]);

  const close = () => {
    setTheme('');
    setDuration(72);
    setError(null);
    onClose();
  };

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const res = await startStudioChallenge(theme.trim(), duration);
    setBusy(false);
    if (res.ok) {
      capture('studio_challenge_started');
      close();
    } else {
      setError(
        res.reason === 'bad_theme'
          ? 'Give it a short theme (2–60 characters).'
          : res.reason === 'already_active'
            ? 'Your Studio already has a challenge running.'
            : 'Could not start a challenge.',
      );
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Studio challenge">
      <Field
        label="Theme"
        placeholder="Something blue"
        value={theme}
        onChangeText={setTheme}
        maxLength={60}
        hint={error ?? 'Everyone in your Studio can add one photo and heart each other’s. No winners, no ranking.'}
        error={!!error}
      />
      {presets.length > 0 && (
        <View style={styles.chipRow}>
          {presets.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              style={styles.chip}
              onPress={() => setTheme(p)}
            >
              <Text style={styles.chipText}>{p}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.seg}>
        {STUDIO_CHALLENGE_DURATIONS.map((d) => (
          <Pressable
            key={d.hours}
            accessibilityRole="button"
            accessibilityState={{ selected: duration === d.hours }}
            style={[styles.segItem, duration === d.hours && styles.segItemOn]}
            onPress={() => setDuration(d.hours)}
          >
            <Text style={[styles.segLabel, duration === d.hours && styles.segLabelOn]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>
      <Button
        label="Start challenge"
        fullWidth
        loading={busy}
        disabled={theme.trim().length < 2}
        onPress={() => void onSubmit()}
      />
    </Sheet>
  );
}

export default function StudiosScreen() {
  const router = useRouter();
  const { code: inviteCode } = useLocalSearchParams<{ code?: string }>();
  const { data: studio, loading, refresh } = useStudio();
  const { data: challenge } = useStudioChallenge();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [challengesEnabled, setChallengesEnabled] = useState(false);
  const [showCreateJoin, setShowCreateJoin] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showStartChallenge, setShowStartChallenge] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nudged, setNudged] = useState(false);
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const [inviteHandled, setInviteHandled] = useState(false);

  useEffect(() => {
    void getConfig('studios_enabled').then(setEnabled);
    void getConfig('studio_challenges_enabled').then(setChallengesEnabled);
  }, []);

  // A Studio-invite deep link (?code=...) lands here once the studio data has
  // settled. Already in one -> explain why the invite didn't do anything
  // (useStudio() is single-studio, there's no join-a-second-one flow). Not in
  // one yet -> open the join sheet prefilled, one tap instead of typing it.
  /* eslint-disable react-hooks/set-state-in-effect -- reacting to useStudio()
     settling, not new async work; a ref can't drive the toast/sheet re-render */
  useEffect(() => {
    if (!inviteCode || inviteHandled || !enabled || loading) return;
    setInviteHandled(true);
    if (studio) {
      setToast("You're already in a Studio");
    } else {
      setShowCreateJoin(true);
    }
  }, [inviteCode, inviteHandled, enabled, loading, studio]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onNudge = async () => {
    setNudgeBusy(true);
    const res = await nudgeStudioDirector();
    setNudgeBusy(false);
    if (res.ok) {
      setNudged(true);
      capture('studio_challenge_nudged');
      setToast('Your Director has been nudged');
    } else if (res.reason === 'already_nudged') {
      setNudged(true);
      setToast('Already nudged today');
    } else {
      setToast('Could not send — check your connection');
    }
  };

  if (enabled === null || (enabled && loading && !studio)) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Studios" />
      </SafeAreaView>
    );
  }

  if (!enabled) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Studios" />
        <View style={styles.body}>
          <EmptyState
            icon={Users}
            line="Play piqa with your friends. Same shot, same day, together."
            ctaLabel="Create or join a Studio"
            onCta={() => setToast('Studios is on its way — not open yet')}
          />
        </View>
        <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
      </SafeAreaView>
    );
  }

  if (!studio) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Studios" />
        <View style={styles.body}>
          <EmptyState
            icon={Users}
            line="Play piqa with your friends. Same shot, same day, together."
            ctaLabel="Create or join a Studio"
            onCta={() => setShowCreateJoin(true)}
          />
        </View>
        <CreateJoinSheet
          visible={showCreateJoin}
          initialMode={inviteCode ? 'join' : 'create'}
          initialCode={inviteCode ?? ''}
          onClose={() => {
            setShowCreateJoin(false);
            void refresh();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        right={
          <IconButton
            icon={MoreHorizontal}
            accessibilityLabel="Studio members"
            onPress={() => router.push('/studio-members')}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={colors.paper60} refreshing={false} onRefresh={() => void refresh()} />}
      >
        <MemberPile faces={studio.membersPreview} total={studio.memberCount} />
        <Text style={styles.name}>{studio.name}</Text>
        {studio.streakDays > 0 && (
          <Text style={styles.meta}>🔥 {studio.streakDays}-day shared streak</Text>
        )}

        <View style={[styles.card, styles.cardCenter]}>
          <Text style={styles.standingLine}>
            <Text style={styles.standingBold}>{studio.standingMade}</Text> of{' '}
            <Text style={styles.standingBold}>{studio.standingOf}</Text> members made today’s gallery
          </Text>
        </View>

        {!challengesEnabled ? (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Studio challenge</Text>
              <Mono size={typeScale.caption} color={colors.paper40}>SOON</Mono>
            </View>
          </View>
        ) : !challenge ? (
          studio.isDirector ? (
            <Pressable
              accessibilityRole="button"
              style={styles.card}
              onPress={() => setShowStartChallenge(true)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Studio challenge</Text>
                <Text style={styles.cardCta}>Start one</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              style={styles.card}
              disabled={nudgeBusy || nudged}
              onPress={() => void onNudge()}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Studio challenge</Text>
                <Text style={styles.cardCta}>{nudged ? 'Nudged' : 'Nudge your Director'}</Text>
              </View>
            </Pressable>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            style={styles.card}
            onPress={() => router.push('/studio-challenge')}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel} numberOfLines={1}>{challenge.theme}</Text>
              <Text style={styles.cardMeta}>{formatChallengeTimeLeft(challenge.endsAt)}</Text>
            </View>
          </Pressable>
        )}

        <Button label="Invite a friend" fullWidth onPress={() => setShowInvite(true)} />
      </ScrollView>

      <InviteSheet
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        code={studio.inviteCode}
        name={studio.name}
      />
      <StartChallengeSheet visible={showStartChallenge} onClose={() => setShowStartChallenge(false)} />
      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  body: { flex: 1, justifyContent: 'center' },
  content: { padding: space.gutter, gap: 16 },
  pile: { flexDirection: 'row', alignItems: 'center' },
  presenceDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.safelight,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  overflowBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink2,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: fonts.sansSemiBold, fontSize: typeScale.title, color: colors.paper },
  meta: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, padding: 16 },
  cardCenter: { alignItems: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper, flexShrink: 1 },
  cardCta: { fontFamily: fonts.sansMedium, fontSize: typeScale.caption, color: colors.safelight },
  cardMeta: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  standingLine: { fontFamily: fonts.sans, fontSize: typeScale.body, color: colors.paper, textAlign: 'center' },
  standingBold: { fontFamily: fonts.sansSemiBold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: space.xxsPlus, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.sansMedium, fontSize: typeScale.caption, color: colors.paper60 },
  seg: { flexDirection: 'row', backgroundColor: colors.ink, borderRadius: radius.pill, padding: space.hair },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  segItemOn: { backgroundColor: colors.paper },
  segLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.caption, color: colors.paper60 },
  segLabelOn: { color: colors.ink },
  inviteLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  codeBox: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    paddingVertical: 20,
    alignItems: 'center',
  },
});
