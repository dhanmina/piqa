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
import { MoreHorizontal, Share, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { asFrameId, asStatus } from '@lib/frames';
import { useSignedThumb } from '@lib/gallery';
import { shareCard } from '@lib/share';
import { useSession } from '@lib/session';
import { supabase } from '@lib/supabase';
import { Avatar } from '@/components/atoms/Avatar';
import { HeartButton } from '@/components/atoms/HeartButton';
import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { ReportSheet } from '@/components/molecules/ReportSheet';
import { ShareCard } from '@/components/molecules/ShareCard';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
import { colors, fade, fonts, frame, icons, space, typeScale } from '@/components/tokens';

// The heart that blooms at a double-tap and flies into the heart control.
const FLY_HEART = 64;

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
  /** The day's theme/brief — passed through to the share card when the host has it. */
  theme?: string | null;
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
  theme,
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
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Off-screen card, snapshotted on Share — no preview sheet (the OS share sheet
  // already previews the image; a second preview was a redundant extra tap).
  const shareCardRef = useRef<View>(null);
  const isOwn = Boolean(myId && userId && myId === userId);

  const openProfile = (uid: string) => {
    if (onOpenProfile) onOpenProfile(uid);
    else router.push({ pathname: '/u/[id]', params: { id: uid } });
  };

  const onShare = async () => {
    if (sharing || !shareCardRef.current) return;
    setSharing(true);
    try {
      const result = await shareCard(shareCardRef);
      if (result === 'unavailable') setToast('Sharing isn’t available on this device.');
    } catch {
      setToast('Couldn’t create the image. Try again.');
    } finally {
      setSharing(false);
    }
  };

  const onReported = () => {
    setShowReport(false);
    setToast("Thanks. We'll take a look, and you won't see this photo again.");
    setTimeout(onClose, 1100); // hide it from the reporter (spec §12)
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

  // Double-tap to like — others' photos only (you can't heart your own). A heart
  // blooms where you tapped and sails into the heart control. Double-tap only ever
  // LIKES, never un-likes, the way people expect the gesture to behave.
  // The overlay lives in the root view, so tap + target must be in ROOT-LOCAL
  // space. Gestures report window coords, so we subtract the root's window origin.
  // (The route presentation can offset the view from the window's top-left.)
  const rootRef = useRef<View>(null);
  const rootOrigin = useRef({ x: 0, y: 0 });
  const measureRoot = () => {
    (rootRef.current as any)?.measureInWindow((x: number, y: number) => {
      rootOrigin.current = { x, y };
    });
  };
  const heartRef = useRef<View>(null);

  const flyX = useSharedValue(0);
  const flyY = useSharedValue(0);
  const flyScale = useSharedValue(0);
  const flyOpacity = useSharedValue(0);
  const flyStyle = useAnimatedStyle(() => ({
    opacity: flyOpacity.value,
    transform: [
      { translateX: flyX.value - FLY_HEART / 2 },
      { translateY: flyY.value - FLY_HEART / 2 },
      { scale: flyScale.value },
    ],
  }));

  // A slow, soft beat: bloom gently at the tap, hold, then glide into the heart.
  const flyTo = (startX: number, startY: number, targetX: number, targetY: number) => {
    flyX.value = startX;
    flyY.value = startY;
    flyScale.value = 0.3;
    const glide = { duration: 620, easing: Easing.inOut(Easing.cubic) };
    flyOpacity.value = withSequence(withTiming(1, { duration: 160 }), withDelay(320, withTiming(0, { duration: 540 })));
    flyScale.value = withSequence(
      withSpring(1, { damping: 13, stiffness: 130 }),
      withDelay(180, withTiming(0.4, { duration: 620, easing: Easing.in(Easing.cubic) })),
    );
    flyX.value = withDelay(360, withTiming(targetX, glide));
    flyY.value = withDelay(360, withTiming(targetY, glide));
  };

  const likeFromDoubleTap = (absX: number, absY: number) => {
    if (isOwn) return; // never heart your own photo
    if (!liked) void toggle();
    const ox = rootOrigin.current.x;
    const oy = rootOrigin.current.y;
    const startX = absX - ox;
    const startY = absY - oy;
    // Measure the heart button fresh on each tap (its onLayout position can be
    // stale before the bar has settled), then fly into its center.
    if (heartRef.current) {
      (heartRef.current as any).measureInWindow((x: number, y: number, w: number, h: number) => {
        const hasBox = w > 0 || h > 0;
        const targetX = hasBox ? x + w / 2 - ox : startX;
        const targetY = hasBox ? y + h / 2 - oy : startY + 160;
        flyTo(startX, startY, targetX, targetY);
      });
    } else {
      flyTo(startX, startY, startX, startY + 160);
    }
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((e) => {
      runOnJS(likeFromDoubleTap)(e.absoluteX, e.absoluteY);
    });

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
    <View ref={heartRef} collapsable={false}>
      <HeartButton
        onPhoto
        readOnly={isOwn}
        liked={liked}
        count={Math.max(baseHeartsValue + delta, 0)}
        onToggle={() => void toggle()}
        onCountPress={() => setShowReactors(true)}
      />
    </View>
  );
  // Engagement lives together (heart + share), right of the shooter — one place to
  // act on the photo. Share is a bare glyph over the fade, matching the heart's
  // on-photo treatment rather than a top scrim chip.
  const actionsBlock = (
    <View style={styles.actions}>
      {heartControl}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share photo"
        hitSlop={12}
        disabled={sharing}
        onPress={() => void onShare()}
        style={sharing ? styles.sharing : undefined}
      >
        {/* 20, not 24: lucide's share glyph fills ~20/24 of its box while the
            HeartGlyph path only spans ~16/24, so a matched nominal size made
            share read visibly larger. 20 optically matches the heart beside it. */}
        <Share size={20} strokeWidth={icons.strokeWidth} color={colors.paper} />
      </Pressable>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.ghRoot}>
    <View ref={rootRef} onLayout={measureRoot} style={[styles.root, lightbox && styles.lightboxRoot]}>
      {/* Lightbox backdrop: a tap anywhere off the print dismisses. Sits behind the
          interactive stage; the print's own controls (heart, shooter) still work. */}
      {lightbox && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close photo" />
      )}
      <View style={[styles.stage, lightbox && styles.stageCentered]} pointerEvents="box-none">
        {/* Double-tap the print to like it. The detector also stops a single tap on
            the print from reaching the lightbox backdrop, so the photo never
            dismisses by accident. */}
        <GestureDetector gesture={doubleTap}>
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
                {actionsBlock}
              </View>
            </>
          )}
        </View>
        </GestureDetector>
      </View>

      {lightbox && (
        <View
          style={[styles.lightboxBar, { paddingBottom: insets.bottom + space.gutter }]}
          pointerEvents="box-none"
        >
          {identityBlock}
          {actionsBlock}
        </View>
      )}

      {/* Chrome floats over the print as scrim chips. */}
      <View style={[styles.headerFloat, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon={X} variant="chrome" accessibilityLabel="Close" onPress={onClose} />
        {!isOwn && (
          <IconButton icon={MoreHorizontal} variant="chrome" accessibilityLabel="Report photo" onPress={() => setShowReport(true)} />
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

      {/* Off-screen composer: mounted + laid out (so view-shot can snapshot it),
          but far off-screen and never shown. The photo is already warm from the
          viewer above, so the capture includes it. */}
      <View style={styles.shareStage} pointerEvents="none">
        <ShareCard
          ref={shareCardRef}
          photoUri={uri}
          dayNumber={day}
          frameId={frameId}
          status={status}
          shooter={shooter || 'shooter'}
          theme={theme}
        />
      </View>

      <ReportSheet visible={showReport} submissionId={id ?? null} onClose={() => setShowReport(false)} onReported={onReported} />

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />

      {/* The flying like-heart — absolute, above everything, never a touch target. */}
      <Animated.View pointerEvents="none" style={[styles.flyHeart, flyStyle]}>
        <HeartGlyph size={FLY_HEART} color={colors.heart} fill={colors.heart} />
      </Animated.View>
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  ghRoot: { flex: 1 },
  flyHeart: { position: 'absolute', left: 0, top: 0 },
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
  // Heart + share sit together, right of the shooter, on the name/eyebrow baseline.
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  sharing: { opacity: 0.4 },
  // Kept in the tree so the snapshot has a laid-out card, but never on screen.
  shareStage: { position: 'absolute', left: -9999, top: 0 },
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
});
