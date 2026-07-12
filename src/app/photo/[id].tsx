/**
 * Photo detail (spec §11c) — full-res + shooter (signed appreciation) + heart +
 * EXIF strip. LOCATION IS ALWAYS STRIPPED — no geo data is stored or shown, ever
 * (spec §0 never-do list, §18 stolen from ThemeSnap minus the location). Tap the
 * name → profile (placeholder; Profile is Phase 4).
 */
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Crown, MoreHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignedThumb } from '@lib/gallery';
import { REPORT_REASONS, reportSubmission } from '@lib/moderation';
import { useSession } from '@lib/session';
import { supabase } from '@lib/supabase';
import { Avatar } from '@/components/atoms/Avatar';
import { HeartButton } from '@/components/atoms/HeartButton';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, icons, space, typeScale } from '@/components/tokens';

type Reactor = { id: string; username: string; avatar_url: string | null };

export default function PhotoDetail() {
  const router = useRouter();
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
  }>();

  const uri = useSignedThumb(params.path || null);
  const isPotd = params.potd === '1';
  const baseHearts = Number(params.hearts ?? 0);

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

  const capturedLine = params.captured
    ? new Date(params.captured)
        .toLocaleString('en-US', {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
        .toUpperCase() // camera-readout language (spec §11d)
    : '—';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={X} accessibilityLabel="Close" onPress={() => router.back()} />
        {!isOwn && <IconButton icon={MoreHorizontal} accessibilityLabel="More" onPress={() => setShowReport(true)} />}
      </View>

      <View style={styles.imageWrap}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.skeleton]} />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.nameRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View shooter profile"
            style={styles.nameLeft}
            disabled={!params.user}
            onPress={() => params.user && router.push({ pathname: '/u/[id]', params: { id: params.user } })}
          >
            {isPotd && <Crown size={18} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />}
            <Text style={styles.shooter}>{params.shooter || 'shooter'}</Text>
          </Pressable>
          <HeartButton
            liked={liked}
            count={Math.max(baseHeartsValue + delta, 0)}
            onToggle={() => void toggle()}
            onCountPress={() => setShowReactors(true)}
          />
        </View>

        {/* EXIF strip — mono camera-readout language. No location label: Piqa
            never captures geo, so there's nothing to claim (not even its absence). */}
        <View style={styles.exif}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            {capturedLine}
          </Mono>
        </View>
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
                <Text style={styles.reactorName}>{r.username}</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  imageWrap: { flex: 1, backgroundColor: colors.ink },
  skeleton: { backgroundColor: colors.ink2 },
  footer: {
    padding: space.gutter,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink2, // hairline between the print and its readout
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shooter: { fontFamily: displayFamily, fontSize: typeScale.title, color: colors.paper },
  exif: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyReactors: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  reactorScroll: { maxHeight: 320 },
  reactorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  reactorName: { fontFamily: displayFamily, fontSize: typeScale.body, color: colors.paper },
  reasonRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
  reasonLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.paper },
});
