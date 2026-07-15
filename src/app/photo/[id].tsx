/**
 * Photo detail (spec §11c) — full-res + shooter (signed appreciation) + heart +
 * EXIF strip. LOCATION IS ALWAYS STRIPPED — no geo data is stored or shown, ever
 * (spec §0 never-do list, §18 stolen from ThemeSnap minus the location). Tap the
 * name → profile (placeholder; Profile is Phase 4).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { asFrameId, asStatus } from '@lib/frames';
import { useSignedThumb } from '@lib/gallery';
import { REPORT_REASONS, reportSubmission } from '@lib/moderation';
import { useSession } from '@lib/session';
import { supabase } from '@lib/supabase';
import { Avatar } from '@/components/atoms/Avatar';
import { HeartButton } from '@/components/atoms/HeartButton';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
import { colors, fade, fonts, frame, space, typeScale } from '@/components/tokens';

type Reactor = { id: string; username: string; avatar_url: string | null };

export default function PhotoDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id;
  const params = useLocalSearchParams<{
    id: string;
    path?: string;
    shooter?: string;
    hearts?: string;
    captured?: string;
    potd?: string;
    user?: string;
    day?: string;
    status?: string;
    frame?: string;
  }>();

  const uri = useSignedThumb(params.path || null);
  const baseHearts = Number(params.hearts ?? 0);

  // This is the one screen that says the frame's marks out loud. That is why
  // there is no tooltip and no legend sheet anywhere else in the app — the print
  // shows the glyph, and the detail view spells it out in words.
  const dayNumber = Number(params.day ?? 0);
  const status = asStatus(params.status);
  const frameId = asFrameId(params.frame);
  const statusWords = status === 'crown' ? 'Photo of the Day' : status === 'top10' ? 'Top 10' : null;

  const [liked, setLiked] = useState(false);
  const [delta, setDelta] = useState(0); // local heart adjustment on top of the base
  const [liveBase, setLiveBase] = useState<number | null>(null);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [showReactors, setShowReactors] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const isOwn = Boolean(myId && params.user && myId === params.user);

  const onReport = async (reason: string) => {
    if (!params.id) return;
    setShowReport(false);
    await reportSubmission(params.id, reason);
    setToast("Thanks. We'll take a look.");
    setTimeout(() => router.back(), 900); // hide it from the reporter (spec §12)
  };

  // Signed reactors only (votes stay anonymous) — spec §8.
  const loadReactors = useCallback(async () => {
    if (!params.id) return;
    const { data: rx } = await supabase.from('reactions').select('user_id').eq('submission_id', params.id);
    const ids = (rx ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setReactors([]);
      return;
    }
    const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
    setReactors(profs ?? []);
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    let alive = true;
    void (async () => {
      const [{ data: sub }, { data: mine }] = await Promise.all([
        supabase.from('submissions').select('vote_count, reaction_count').eq('id', params.id).maybeSingle(),
        myId
          ? supabase.from('reactions').select('user_id').eq('user_id', myId).eq('submission_id', params.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      if (sub) setLiveBase(sub.vote_count + sub.reaction_count);
      setLiked(!!mine);
      void loadReactors();
    })();
    return () => {
      alive = false;
    };
  }, [myId, params.id, loadReactors]);

  const toggle = async () => {
    if (!myId || !params.id) return;
    const next = !liked;
    setLiked(next);
    setDelta((d) => d + (next ? 1 : -1));
    if (next) {
      const { error } = await supabase.from('reactions').insert({ user_id: myId, submission_id: params.id, emoji: 'heart' });
      if (error) {
        setLiked(false);
        setDelta((d) => d - 1);
      }
    } else {
      const { error } = await supabase.from('reactions').delete().eq('user_id', myId).eq('submission_id', params.id);
      if (error) {
        setLiked(true);
        setDelta((d) => d + 1);
      }
    }
    void loadReactors();
  };

  const baseHeartsValue = liveBase ?? baseHearts;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.stage}>
        <View>
          <FramedPhoto photoUri={uri} dayNumber={dayNumber} frameId={frameId} status={status} />

          {/* Legibility scrim: a bottom fade so overlaid details read on any
              photo. A text scrim, not decoration — the print itself is untouched.
              It stops at the rail; the rail is part of the print, not free canvas.
              No location is ever shown here (spec §0). */}
          <LinearGradient pointerEvents="none" colors={fade} locations={[0, 1]} style={styles.fade} />

          <View pointerEvents="box-none" style={styles.overlay}>
            <View style={styles.identity}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View shooter profile"
                style={styles.nameLeft}
                disabled={!params.user}
                onPress={() => params.user && router.push({ pathname: '/u/[id]', params: { id: params.user } })}
              >
                <Text style={styles.shooter} numberOfLines={1}>
                  {params.shooter || 'shooter'}
                </Text>
              </Pressable>
              {statusWords && (
                <Mono
                  size={typeScale.caption}
                  weight="medium"
                  color={status === 'crown' ? colors.crown : colors.safelight}
                  style={styles.statusEyebrow}
                >
                  {statusWords.toUpperCase()}
                </Mono>
              )}
            </View>
            <HeartButton
              onPhoto
              liked={liked}
              count={Math.max(baseHeartsValue + delta, 0)}
              onToggle={() => void toggle()}
              onCountPress={() => setShowReactors(true)}
            />
          </View>
        </View>
      </View>

      {/* Chrome floats over the print as scrim chips. */}
      <View style={[styles.headerFloat, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon={X} variant="chrome" accessibilityLabel="Close" onPress={() => router.back()} />
        {!isOwn && (
          <IconButton icon={MoreHorizontal} variant="chrome" accessibilityLabel="More" onPress={() => setShowReport(true)} />
        )}
      </View>

      <Sheet visible={showReactors} onClose={() => setShowReactors(false)} title="Reactions">
        {reactors.length === 0 ? (
          <Text style={styles.emptyReactors}>No signed reactions yet. Votes stay anonymous.</Text>
        ) : (
          <ScrollView style={styles.reactorScroll}>
            {reactors.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                style={styles.reactorRow}
                onPress={() => {
                  setShowReactors(false);
                  router.push({ pathname: '/u/[id]', params: { id: r.id } });
                }}
              >
                <Avatar username={r.username} uri={r.avatar_url} size={36} />
                <Text style={styles.reactorName} numberOfLines={1}>
                  {r.username}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>

      <Sheet visible={showReport} onClose={() => setShowReport(false)} title="Report this photo">
        {REPORT_REASONS.map((r) => (
          <Pressable
            key={r.value}
            accessibilityRole="button"
            style={styles.reasonRow}
            onPress={() => void onReport(r.value)}
          >
            <Text style={styles.reasonLabel}>{r.label}</Text>
          </Pressable>
        ))}
      </Sheet>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  stage: { flex: 1, justifyContent: 'center' },
  // Both overlays stop at the top of the frame's rail (the bottom 9.6% of the
  // print), so PIQA, the day counter and the dot are never covered.
  fade: { position: 'absolute', left: 0, right: 0, bottom: frame.window.bottom, height: '46%' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: frame.window.bottom,
    paddingHorizontal: space.gutter,
    // Extra air above the rail so the caption doesn't crowd PIQA / the day counter.
    paddingBottom: space.gutter + 8,
    flexDirection: 'row',
    alignItems: 'flex-end', // heart sits on the name/eyebrow baseline
    gap: 12,
  },
  headerFloat: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Name + status read as one unit — tight pairing, with the air below (overlay
  // paddingBottom) separating them from the rail.
  identity: { flex: 1, gap: 3 },
  nameLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  shooter: { fontFamily: displayFamily, fontSize: typeScale.title, color: colors.paper, flexShrink: 1 },
  statusEyebrow: { letterSpacing: 1.5 },
  emptyReactors: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  reactorScroll: { maxHeight: 320 },
  reactorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  reactorName: { flexShrink: 1, fontFamily: displayFamily, fontSize: typeScale.body, color: colors.paper },
  reasonRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
  reasonLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.paper },
});
