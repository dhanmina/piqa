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
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MoreHorizontal, Share, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ListRenderItemInfo } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { signThumb } from '@lib/cache';
import { asFrameId, asStatus } from '@lib/frames';
import { useSignedThumb } from '@lib/gallery';
import { getPhotoNods, nodLabel, nodsFor, submitNod, topNod, type NodCounts, type NodTag } from '@lib/nods';
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

// Instagram-style pager dots, driven by the live scroll offset (not the settled
// page): the pip under you is full-size and the app's accent, and it grows/shrinks
// continuously as you drag between frames. A sliding window of at most DOT_MAX pips
// tracks the scroll — the strip translates to keep the current pip centred (clamped
// at the ends), and pips past the window taper to nothing, so even a long gallery
// stays a compact, positioned strip.
const DOT_MAX = 7;
const DOT_BASE = 8; // active/base diameter; every other pip scales down from this
const DOT_SLOT = 14; // per-pip horizontal slot (diameter + gap)
const DOT_HALF = Math.floor(DOT_MAX / 2);

function Dot({ index, scrollX, pageW }: { index: number; scrollX: SharedValue<number>; pageW: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.value / pageW - index); // distance from the live position
    return {
      transform: [{ scale: interpolate(d, [0, 1, 2, 3, 4, 5], [1, 0.75, 0.75, 0.56, 0.38, 0], Extrapolation.CLAMP) }],
      backgroundColor: interpolateColor(d, [0, 0.9], [colors.safelight, colors.paper40]),
    };
  });
  return (
    <View style={styles.dotSlot}>
      <Animated.View style={[styles.dotCircle, style]} />
    </View>
  );
}

function PagerDots({ scrollX, total, pageW }: { scrollX: SharedValue<number>; total: number; pageW: number }) {
  const visible = Math.min(total, DOT_MAX);
  const trackStyle = useAnimatedStyle(() => {
    if (total <= DOT_MAX) return { transform: [{ translateX: 0 }] };
    const progress = scrollX.value / pageW;
    const center = Math.min(Math.max(progress, DOT_HALF), total - 1 - DOT_HALF);
    return { transform: [{ translateX: (DOT_HALF - center) * DOT_SLOT }] };
  });
  return (
    <View style={[styles.dotsViewport, { width: visible * DOT_SLOT }]}>
      <Animated.View style={[styles.dotsTrack, trackStyle]}>
        {Array.from({ length: total }, (_, i) => (
          <Dot key={i} index={i} scrollX={scrollX} pageW={pageW} />
        ))}
      </Animated.View>
    </View>
  );
}

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
  /** The Subject's category (light/color/pov/absurd/emotion/object) — narrows the
   *  nod picker to the tags that best fit this image. Absent → the full set. */
  category?: string | null;
  /** Per-photo nod aggregate ({ great_light: 38, ... }), from decorate_photos. */
  nods?: NodCounts | null;
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
  /** Hide the shooter name/profile link. For contexts where the shot is implicitly
   *  the viewer's own (the activity inbox), so naming the shooter is redundant. The
   *  status eyebrow, received nods and hearts still show. */
  hideShooter?: boolean;
  /** Controlled heart mode. The gallery hosts BOTH the grid and this fullscreen,
   *  so it drives both from the same `useGalleryHearts` controller — passing the
   *  count/liked/toggle in here keeps the two surfaces identical and in sync (a
   *  heart here moves the grid tile too). When omitted (the /photo/[id] route and
   *  profile, which have no adjacent grid), the view falls back to its own live
   *  count from `submissions`. All three must be provided together. */
  heartCount?: number;
  hearted?: boolean;
  onToggleHeart?: () => void;
  /** When provided, the viewer pages horizontally through the list (swipe left/right).
   *  Each item is a PhotoDetailData. The single-photo props (id, path, etc.) are
   *  used for the initial render; paging overrides them per-page. */
  photos?: PhotoDetailData[];
  /** Index in `photos` to start on. Defaults to 0. */
  initialIndex?: number;
  /** Called when the page changes (swipe). The host can update heart state. */
  onPageChange?: (index: number) => void;
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
  category,
  nods,
  placeholderUri,
  onClose,
  onOpenProfile,
  lightbox = false,
  hideShooter = false,
  heartCount,
  hearted,
  onToggleHeart,
  photos,
  initialIndex = 0,
  onPageChange,
}: Props) {
  // Controlled heart mode: the gallery drives this fullscreen off the SAME
  // useGalleryHearts state as its grid, so both show one number and toggle
  // together. Uncontrolled (route / profile) → the internal live-count path below.
  const heartControlled = onToggleHeart !== undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // Lightbox print: make the framed print the hero — as large as the viewport
  // allows while the WHOLE 3:4 frame (rail included) stays visible. Bounded by a
  // slim side margin AND by the height left between the top chrome (close/report)
  // and the bottom identity bar, whichever binds first. On phones the width binds
  // (near edge-to-edge); on tablets the height binds, so the print never overruns
  // the bar. Route mode fills the screen (width undefined).
  const fsChromeV = insets.top + 48 + insets.bottom + 104;
  const printW = lightbox
    ? Math.min(winW - space.gutter, (winH - fsChromeV) * frame.aspect)
    : undefined;
  const { session } = useSession();
  const myId = session?.user.id;

  const baseHearts = hearts;

  // --- Paging (gallery + profile modals) ---
  // Any caller that passes `photos` uses the polished paged layout (measured stage,
  // bar reserve, tap-to-exit) — even a single item — so the fullscreen is identical
  // everywhere. Swipe + dots only appear when there's more than one. The route and
  // profile-less callers omit `photos` and fall to the single/route branch.
  const hasPaging = Boolean(photos && photos.length >= 1);
  const [page, setPage] = useState(initialIndex);
  // Measured height of the paging stage (the area above the bottom bar). The bar
  // grows with the nods chips / "why it won" note, so the print MUST be sized to
  // the real remaining space — a winH-based estimate clipped the frame's bottom
  // rail whenever the bar was taller than assumed.
  const [stageH, setStageH] = useState(0);
  // Tallest meta bar observed (measured, includes its safe-area inset). The bar's
  // height varies per photo — nod chips can wrap to two rows on others' shots, a
  // "why it won" note on the crown — so we reserve its ACTUAL height, and keep the
  // MAX so the print clears the tallest bar yet never resizes back down. That way
  // the frame is never cut AND never jumps between photos.
  const [barH, setBarH] = useState(0);
  const listRef = useRef<FlatList<PhotoDetailData>>(null);
  // Live horizontal scroll offset — drives the pager dots continuously (UI thread).
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // Vertical pan-to-dismiss (StarredLightbox pattern).
  const DISMISS_DISTANCE = 130;
  const ty = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetY([-16, 16])
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        ty.value = withTiming(0, { duration: 160 });
      }
    });
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(ty.value / (winH * 0.6), 0.75),
  }));

  // Pre-sign all photo paths for paging, so each page opens instantly.
  const [signedUris, setSignedUris] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!hasPaging || !photos) return;
    let alive = true;
    const paths = photos.map((p) => p.path).filter((p): p is string => !!p);
    if (paths.length === 0) return;
    Promise.all(paths.map((p) => signThumb(p))).then((results) => {
      if (!alive) return;
      const m = new Map<string, string>();
      paths.forEach((p, i) => { const u = results[i]; if (u) m.set(p, u); });
      setSignedUris(m);
    });
    return () => { alive = false; };
  }, [hasPaging, photos]);

  // Resolve the active photo for paging — falls back to the single-photo props.
  const active = hasPaging && photos ? photos[page] : null;
  const activeId = active?.id ?? id;
  const activePath = active?.path ?? path;
  // Always call useSignedThumb (React rules of hooks); only used in single-photo mode.
  const singleUri = useSignedThumb(path || null);
  const activeUri = activePath ? (signedUris.get(activePath) ?? null) : singleUri;
  const activeShooter = active?.shooter ?? shooter;
  const activeUserId = active?.userId ?? userId;
  const activeDay = active?.day ?? day;
  const activeStatus = active?.status ?? statusRaw;
  const activeFrame = active?.frame ?? frameRaw;
  const activeNods = active?.nods ?? nods;
  const activePlaceholder = active?.placeholderUri ?? placeholderUri;
  const activeCategory = active?.category ?? category;

  // This is the one view that says the frame's marks out loud — the print shows
  // the glyph, and here it's spelled out in words. Derive from active photo in paging mode.
  const status = asStatus(activeStatus);
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
  const isOwn = Boolean(myId && activeUserId && myId === activeUserId);

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
    if (!activeId) return;
    const { data: rx } = await supabase.from('reactions').select('user_id').eq('submission_id', activeId);
    const ids = (rx ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setReactors([]);
      return;
    }
    const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
    setReactors(profs ?? []);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    // Controlled mode: count + liked come from the host (useGalleryHearts); we
    // only still need the signed-reactor list for the sheet.
    if (heartControlled) {
      void loadReactors();
      return;
    }
    let alive = true;
    void (async () => {
      const [{ data: sub }, { data: mine }] = await Promise.all([
        // Likes only — the heart never counts anonymous blind votes (reaction_count
        // is the signed-heart tally; vote_count is the hidden ranking signal).
        supabase.from('submissions').select('reaction_count').eq('id', activeId).maybeSingle(),
        myId
          ? supabase.from('reactions').select('user_id').eq('user_id', myId).eq('submission_id', activeId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!alive) return;
      if (sub) setLiveBase(sub.reaction_count);
      setLiked(!!mine);
      void loadReactors();
    })();
    return () => {
      alive = false;
    };
  }, [myId, activeId, loadReactors, heartControlled]);

  const toggle = async () => {
    if (!myId || !activeId) return;
    const next = !liked;
    setLiked(next);
    setDelta((d) => d + (next ? 1 : -1));
    if (next) {
      const { error } = await supabase.from('reactions').insert({ user_id: myId, submission_id: activeId, emoji: 'heart' });
      if (error) {
        setLiked(false);
        setDelta((d) => d - 1);
      }
    } else {
      const { error } = await supabase.from('reactions').delete().eq('user_id', myId).eq('submission_id', activeId);
      if (error) {
        setLiked(true);
        setDelta((d) => d + 1);
      }
    }
    void loadReactors();
  };

  const baseHeartsValue = liveBase ?? baseHearts;
  // One source of truth for what the heart shows: the host's controller when
  // present, else the internal live state. Both surfaces (grid + this view) read
  // the same numbers in controlled mode, so they can't disagree.
  const displayLiked = heartControlled ? !!hearted : liked;
  const displayCount = heartControlled ? heartCount ?? 0 : Math.max(baseHeartsValue + delta, 0);
  const doToggle = heartControlled ? onToggleHeart! : () => void toggle();

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
    if (!displayLiked) doToggle(); // double-tap only ever likes, never un-likes
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

  // Nods — craft recognition (feature-research §3): the top tag as an aggregate,
  // plus a one-tap picker on others' photos (optimistic via myNod). Attaches after
  // the reveal, when the photo is named — never on the blind voting pairs.
  const [myNod, setMyNod] = useState<NodTag | null>(null);
  // Per-photo nods, so the profile's fullscreen reads exactly like the gallery's:
  // reset your session pick when the photo changes (fixes a carryover across swipes),
  // and fetch the public aggregate when the caller didn't supply one — the gallery
  // passes it via decorate_photos; a profile's wins don't carry it.
  const [fetchedNods, setFetchedNods] = useState<NodCounts | null>(null);
  useEffect(() => {
    setMyNod(null);
    if (!activeId || activeNods) {
      setFetchedNods(null);
      return;
    }
    let alive = true;
    void getPhotoNods(activeId).then((n) => {
      if (alive) setFetchedNods(n);
    });
    return () => {
      alive = false;
    };
  }, [activeId, activeNods]);
  const displayNods: NodCounts = { ...(activeNods ?? fetchedNods ?? {}) };
  if (myNod) displayNods[myNod] = (displayNods[myNod] ?? 0) + 1;
  const topTag = topNod(displayNods);
  const nodsBlock =
    topTag || !isOwn ? (
      <View style={styles.nods}>
        {topTag && (
          <Mono size={typeScale.caption} color={colors.paper60}>
            {`Curators nodded: ${topTag.label} ×${topTag.count}`}
          </Mono>
        )}
        {!isOwn &&
          (myNod ? (
            <Mono size={typeScale.caption} color={colors.safelight}>
              {`You nodded: ${nodLabel(myNod)}`}
            </Mono>
          ) : (
            <View style={styles.nodChips}>
              {nodsFor(activeCategory).map((t) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  style={styles.nodChip}
                  onPress={() => {
                    setMyNod(t.id);
                    void submitNod(activeId!, t.id);
                  }}
                >
                  <Text style={styles.nodChipText}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
      </View>
    ) : null;

  // "Why this won" — the PotD's editorial note (learning loop). Fetched directly
  // (public-gallery RLS), only for the crowned photo — off the get_gallery path.
  const [potdNote, setPotdNote] = useState<string | null>(null);
  useEffect(() => {
    if (activeStatus !== 'crown' || !activeId) {
      setPotdNote(null);
      return;
    }
    let alive = true;
    void supabase
      .from('submissions')
      .select('potd_note')
      .eq('id', activeId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setPotdNote((data as { potd_note?: string | null } | null)?.potd_note ?? null);
      });
    return () => {
      alive = false;
    };
  }, [activeStatus, activeId]);

  // The signed-appreciation pair — shooter (→ profile) + heart. Shared by the
  // route's on-cover overlay and the lightbox's bottom bar.
  const identityBlock = (
    <View style={styles.identity}>
      {!hideShooter && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View shooter profile"
          style={styles.nameLeft}
          disabled={!activeUserId}
          onPress={() => activeUserId && openProfile(activeUserId)}
        >
          <Text style={styles.shooter} numberOfLines={1}>
            {activeShooter || 'shooter'}
          </Text>
        </Pressable>
      )}
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
      {nodsBlock}
      {status === 'crown' && potdNote && (
        <Text style={styles.potdNote} numberOfLines={3}>{`Why it won: ${potdNote}`}</Text>
      )}
    </View>
  );
  const heartControl = (
    <View ref={heartRef} collapsable={false}>
      <HeartButton
        onPhoto
        readOnly={isOwn}
        liked={displayLiked}
        count={displayCount}
        onToggle={doToggle}
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

  // In paging mode, render each photo in a full-width page so the FlatList can
  // scroll horizontally with pagingEnabled. The FramedPhoto sits centered inside.
  // The floating chrome (close / report) occupies the top of the stage — reserve
  // it so the print centers in the space BELOW the header and its top corners are
  // never tucked under the buttons.
  const headroom = insets.top + 48;
  // Reserve the MEASURED (max-observed) bar height + a small gap, so the print box
  // clears even the tallest bar (2 rows of nod chips, a crown note) on any screen
  // size, never gets cut, and never oscillates. Fall back to an estimate until the
  // bar has laid out once.
  const BAR_RESERVE = (barH > 0 ? barH : insets.bottom + 150) + 10;
  // Fit the whole 3:4 print inside the stage minus the header and that reserved band;
  // width bounds it too. `* 0.98` leaves a hair of breathing room. Before the first
  // layout pass (stageH 0) fall back to the component estimate.
  const availH = Math.max(stageH - headroom - BAR_RESERVE, 0);
  const pagePrintW =
    stageH > 0 ? Math.min(winW - space.gutter, availH * frame.aspect * 0.98) : printW;

  const renderPagingItem = ({ item }: ListRenderItemInfo<PhotoDetailData>) => {
    const itemUri = item.path ? (signedUris.get(item.path) ?? null) : null;
    const itemFrame = asFrameId(item.frame);
    const itemStatus = asStatus(item.status);
    // A FRESH tap gesture per page — a single shared Gesture instance attached to
    // several mounted pages at once makes Reanimated warn about re-tagging one
    // worklet object. Each detector must own its instance.
    const tap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(280)
      .onEnd((e) => {
        runOnJS(likeFromDoubleTap)(e.absoluteX, e.absoluteY);
      });
    return (
      // Definite pixel height (the measured stage), NOT '100%': in a horizontal
      // list a percentage height is unreliable, which left the absoluteFill close
      // target collapsed to the print's band — so only the strip level with the
      // frame exited. A concrete height makes the backdrop span the whole stage.
      <View style={{ width: winW, height: stageH > 0 ? stageH : '100%' }}>
        {/* Tap ANY dark area around the print to exit. A Pressable claims the touch
            HERE so it can never fall through the transparent modal to the gallery
            behind it, and the print's own GestureDetector swallows single taps, so
            tapping the photo itself never dismisses (only double-tap-to-like). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close photo" />
        <View
          pointerEvents="box-none"
          style={{ flex: 1, paddingTop: headroom, paddingBottom: BAR_RESERVE, alignItems: 'center', justifyContent: 'center' }}
        >
          <GestureDetector gesture={tap}>
          <View>
            <FramedPhoto
              photoUri={itemUri}
              placeholderUri={item.placeholderUri}
              dayNumber={item.day ?? 0}
              frameId={itemFrame}
              status={itemStatus}
              width={pagePrintW}
            />
          </View>
          </GestureDetector>
        </View>
      </View>
    );
  };

  // Track page for identity bar + counter. A light selection tick on each new
  // page gives the swipe a tactile detent, the way a filmstrip clicks between
  // frames — fired only on a genuine page change (not the settle back onto the
  // same page after a short drag).
  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / winW);
    if (idx !== page) {
      setPage(idx);
      onPageChange?.(idx);
      void Haptics.selectionAsync();
    }
  };

  return (
    <GestureHandlerRootView style={styles.ghRoot}>
    <View ref={rootRef} onLayout={measureRoot} style={[styles.root, lightbox && styles.lightboxRoot]}>
      {/* Lightbox backdrop: a tap anywhere off the print dismisses. Sits behind the
          interactive stage; the print's own controls (heart, shooter) still work. */}
      {lightbox && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close photo" />
      )}

      {hasPaging ? (
        /* Paging mode: full-width FlatList pages through photos, vertical
           pan-to-dismiss wraps the content, identity/heart/actions pinned below. */
        <>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pagingBackdrop, backdropStyle]} />
          <Animated.View style={[{ flex: 1 }, contentStyle]}>
            <GestureDetector gesture={pan}>
            <View
              style={{ flex: 1 }}
              pointerEvents="box-none"
              onLayout={(e) => setStageH(e.nativeEvent.layout.height)}
            >
              <Animated.FlatList
                ref={listRef as any}
                data={photos}
                keyExtractor={(it: PhotoDetailData) => it.id}
                renderItem={renderPagingItem}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                // Re-render cells when the print is sized (stage measured) AND on
                // each page change, so the visible page's tap targets the active
                // photo rather than a stale closure from the initial render.
                extraData={`${pagePrintW}:${page}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={initialIndex}
                getItemLayout={(_, i) => ({ length: winW, offset: winW * i, index: i })}
                // Guarantee the tapped photo is the one that opens: if the target
                // cell wasn't laid out in time, initialScrollIndex silently gives up
                // and the viewer sticks at index 0 — jump straight to its offset.
                onScrollToIndexFailed={(info) =>
                  listRef.current?.scrollToOffset({ offset: info.index * winW, animated: false })
                }
                onMomentumScrollEnd={onScroll}
                // Snappier snap between frames, and keep the immediate neighbours
                // mounted (windowSize 3 = current ± 1) so a swipe reveals the next
                // print already drawn instead of flashing the thumb placeholder.
                decelerationRate="fast"
                windowSize={3}
              />
            </View>
            </GestureDetector>
            <SafeAreaView
              edges={['bottom']}
              style={styles.pagingBarSafe}
              pointerEvents="box-none"
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                setBarH((prev) => (h > prev ? h : prev));
              }}
            >
              {/* The bar's blank space (right of the name / status, around the heart
                  and share) exits too — a Pressable owns the background, and the real
                  controls (name → profile, nod chips, heart, share) sit on top and win
                  the touch, so only the empty gaps and plain text dismiss. */}
              <Pressable style={styles.pagingBar} onPress={onClose} accessibilityLabel="Close photo">
                <View style={styles.pagingBarRow}>
                  {identityBlock}
                  {actionsBlock}
                </View>
                {photos && photos.length > 1 && <PagerDots scrollX={scrollX} total={photos.length} pageW={winW} />}
              </Pressable>
            </SafeAreaView>
          </Animated.View>
        </>
      ) : (
        /* Single-photo mode: original behavior. */
        <>
          <View style={[styles.stage, lightbox && styles.stageCentered]} pointerEvents="box-none">
            <GestureDetector gesture={doubleTap}>
            <View>
              <FramedPhoto
                photoUri={activeUri}
                placeholderUri={activePlaceholder}
                dayNumber={activeDay}
                frameId={asFrameId(activeFrame)}
                status={asStatus(activeStatus)}
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
            <SafeAreaView edges={['bottom']} style={styles.lightboxBarSafe} pointerEvents="box-none">
              <View style={styles.lightboxBar}>
                {identityBlock}
                {actionsBlock}
              </View>
            </SafeAreaView>
          )}
        </>
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
          photoUri={activeUri}
          dayNumber={activeDay}
          frameId={asFrameId(activeFrame)}
          status={asStatus(activeStatus)}
          shooter={activeShooter || 'shooter'}
          theme={theme}
        />
      </View>

      <ReportSheet visible={showReport} submissionId={activeId ?? null} onClose={() => setShowReport(false)} onReported={onReported} />

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
  lightboxBarSafe: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  lightboxBar: {
    padding: space.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingHorizontal: 16,
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
  nods: { gap: 6, marginTop: 2 },
  potdNote: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.crown, lineHeight: typeScale.caption * 1.4, marginTop: 2 },
  nodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nodChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paper30,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  nodChipText: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper },
  // alignSelf flex-start so the tap target hugs the name text — the identity block
  // is a column (default cross-axis stretch), which otherwise widened this Pressable
  // to the full bar so blank space right of the name opened the profile by mistake.
  nameLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, alignSelf: 'flex-start' },
  shooter: { fontFamily: displayFamily, fontSize: typeScale.title, color: colors.paper, flexShrink: 1 },
  statusEyebrow: { letterSpacing: 1.5 },
  emptyReactors: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  reactorScroll: { maxHeight: 320 },
  reactorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  reactorName: { flexShrink: 1, fontFamily: displayFamily, fontSize: typeScale.body, color: colors.paper },
  // Fullscreen paging stage: a true near-black so the framed print reads as a
  // hero object and the ink2 rail/border separates from the ground (the shared
  // lightbox dim sits only ~one step off ink2, which made the frame edge vanish).
  pagingBackdrop: { backgroundColor: '#080706' },
  // Paging mode bar — an ABSOLUTE overlay pinned to the bottom, so its per-photo
  // height (nod chips, "why it won") never resizes the stage and shifts the print.
  pagingBarSafe: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,7,6,0.92)' },
  pagingBar: {
    padding: space.gutter,
    gap: 4,
  },
  pagingBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  // Position pips (PagerDots): a fixed-width, clipped viewport centered under the
  // identity/actions row; the track slides inside it and each pip scales in place.
  dotsViewport: { alignSelf: 'center', height: DOT_BASE, marginTop: 4, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  dotsTrack: { flexDirection: 'row', alignItems: 'center' },
  dotSlot: { width: DOT_SLOT, alignItems: 'center', justifyContent: 'center' },
  dotCircle: { width: DOT_BASE, height: DOT_BASE, borderRadius: DOT_BASE / 2 },
});
