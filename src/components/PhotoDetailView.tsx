/**
 * Photo detail (spec §11c) — full-res print + shooter (signed appreciation) +
 * heart + the reactor list + report. LOCATION IS ALWAYS STRIPPED (spec §0).
 *
 * A component, not a screen, so it renders BOTH as the /photo/[id] route (deep
 * links, profile wins) AND as an in-place fullscreen Modal in the gallery — the
 * gallery zooms into a shot without a route change (like the archive viewer).
 *
 * `onClose` closes whichever host presented it (router.back or the modal's
 * setState). `onOpenProfile` lets the host decide how to reach a profile: the
 * route just pushes; the gallery modal must close itself first (an RN Modal sits
 * above the navigator, so a bare push would land behind it).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MoreHorizontal, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export type PhotoDetailData = {
  id: string;
  /** Storage path (image or thumb) to sign and render. */
  path?: string | null;
  shooter?: string;
  hearts?: number;
  /** The shooter's user id — for the profile link and the own-photo check. */
  userId?: string | null;
  /** Global day counter, from the server. */
  day?: number;
  status?: string | null;
  frame?: string | null;
  /** An already-cached thumb (e.g. the gallery grid's) shown instantly under the
   *  full-res image, so opening a shot never waits on a reload. */
  placeholderUri?: string | null;
};

type Props = PhotoDetailData & {
  onClose: () => void;
  /** How to reach a profile. Defaults to a route push; hosts above the navigator
   *  (the gallery modal) override to close themselves first. */
  onOpenProfile?: (userId: string) => void;
  /** Lightbox: the print floats centered on a dimmed, see-through backdrop and a
   *  tap outside it dismisses — the archive-viewer feel, for the in-place gallery
   *  modal. Off (default) = the full opaque screen used by the route. */
  lightbox?: boolean;
};

export function PhotoDetailView({
  id,
  path,
  shooter,
  hearts = 0,
  userId,
  day = 0,
  status: statusRaw,
  frame: frameRaw,
  placeholderUri,
  onClose,
  onOpenProfile,
  lightbox = false,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // Lightbox print: full width minus a gutter, capped so it stays a centered card
  // with backdrop showing around it. Route mode fills the screen (width undefined).
  const printW = lightbox ? Math.min(winW - space.gutter * 2, winH * 0.52) : undefined;
  const { session } = useSession();
  const myId = session?.user.id;

  const uri = useSignedThumb(path || null);
  const baseHearts = hearts;

  // This is the one view that says the frame's marks out loud — the print shows
  // the glyph, and here it's spelled out in words.
  const status = asStatus(statusRaw);
  const frameId = asFrameId(frameRaw);
  const statusWords = status === 'crown' ? 'Photo of the Day' : status === 'top10' ? 'Top 10' : null;

  const [liked, setLiked] = useState(false);
  const [delta, setDelta] = useState(0); // local heart adjustment on top of the base
  const [liveBase, setLiveBase] = useState<number | null>(null);
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [showReactors, setShowReactors] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const isOwn = Boolean(myId && userId && myId === userId);

  const openProfile = (uid: string) => {
    if (onOpenProfile) onOpenProfile(uid);
    else router.push({ pathname: '/u/[id]', params: { id: uid } });
  };

  const onReport = async (reason: string) => {
    if (!id) return;
    setShowReport(false);
    await reportSubmission(id, reason);
    setToast("Thanks. We'll take a look.");
    setTimeout(onClose, 900); // hide it from the reporter (spec §12)
  };

  // Signed reactors only (votes stay anonymous) — spec §8.
  const loadReactors = useCallback(async () => {
    if (!id) return;
    const { data: rx } = await supabase.from('reactions').select('user_id').eq('submission_id', id);
    const ids = (rx ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setReactors([]);
      return;
    }
    const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
    setReactors(profs ?? []);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void (async () => {
      const [{ data: sub }, { data: mine }] = await Promise.all([
        supabase.from('submissions').select('vote_count, reaction_count').eq('id', id).maybeSingle(),
        myId
          ? supabase.from('reactions').select('user_id').eq('user_id', myId).eq('submission_id', id).maybeSingle()
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
  }, [myId, id, loadReactors]);

  const toggle = async () => {
    if (!myId || !id) return;
    const next = !liked;
    setLiked(next);
    setDelta((d) => d + (next ? 1 : -1));
    if (next) {
      const { error } = await supabase.from('reactions').insert({ user_id: myId, submission_id: id, emoji: 'heart' });
      if (error) {
        setLiked(false);
        setDelta((d) => d - 1);
      }
    } else {
      const { error } = await supabase.from('reactions').delete().eq('user_id', myId).eq('submission_id', id);
      if (error) {
        setLiked(true);
        setDelta((d) => d + 1);
      }
    }
    void loadReactors();
  };

  const baseHeartsValue = liveBase ?? baseHearts;

  // The signed-appreciation pair — shooter (→ profile) + heart. Shared by the
  // route's on-cover overlay and the lightbox's bottom bar.
  const identityBlock = (
    <View style={styles.identity}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View shooter profile"
        style={styles.nameLeft}
        disabled={!userId}
        onPress={() => userId && openProfile(userId)}
      >
        <Text style={styles.shooter} numberOfLines={1}>
          {shooter || 'shooter'}
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
  );
  const heartControl = (
    <HeartButton
      onPhoto
      readOnly={isOwn}
      liked={liked}
      count={Math.max(baseHeartsValue + delta, 0)}
      onToggle={() => void toggle()}
      onCountPress={() => setShowReactors(true)}
    />
  );

  return (
    <View style={[styles.root, lightbox && styles.lightboxRoot]}>
      {/* Lightbox backdrop: a tap anywhere off the print dismisses. Sits behind the
          interactive stage; the print's own controls (heart, shooter) still work. */}
      {lightbox && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close photo" />
      )}
      <View style={[styles.stage, lightbox && styles.stageCentered]} pointerEvents="box-none">
        <View>
          <FramedPhoto
            photoUri={uri}
            placeholderUri={placeholderUri}
            dayNumber={day}
            frameId={frameId}
            status={status}
            width={printW}
          />

          {/* Route mode signs the print on its cover — name + heart over a scrim. The
              lightbox keeps the photo clean and moves them to a bottom bar (the archive
              pattern), so the floating print reads unobstructed. */}
          {!lightbox && (
            <>
              <LinearGradient pointerEvents="none" colors={fade} locations={[0, 1]} style={styles.fade} />
              <View pointerEvents="box-none" style={styles.overlay}>
                {identityBlock}
                {heartControl}
              </View>
            </>
          )}
        </View>
      </View>

      {lightbox && (
        <View
          style={[styles.lightboxBar, { paddingBottom: insets.bottom + space.gutter }]}
          pointerEvents="box-none"
        >
          {identityBlock}
          {heartControl}
        </View>
      )}

      {/* Chrome floats over the print as scrim chips. */}
      <View style={[styles.headerFloat, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon={X} variant="chrome" accessibilityLabel="Close" onPress={onClose} />
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
                  openProfile(r.id);
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  // Dimmed, see-through backdrop so the print reads as a floating card (archive feel).
  lightboxRoot: { backgroundColor: 'rgba(12,11,10,0.95)' },
  stage: { flex: 1, justifyContent: 'center' },
  stageCentered: { alignItems: 'center' }, // center the fixed-width print in lightbox mode
  // Lightbox meta bar, pinned to the screen bottom (archive pattern): shooter left,
  // heart right, on the name/eyebrow baseline. Sits in the dim below the floating print.
  lightboxBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: space.gutter,
  },
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
