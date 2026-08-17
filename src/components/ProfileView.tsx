/**
 * Profile — same layout own/others (spec §11c). Identity-first: a left-aligned
 * crest (avatar+frame · name · title·level · hearts·crowns·galleries) over a
 * quiet XP hairline, then a warm Following face pile (self only), then the work —
 * a Wins/Starred segment above a 2-column print grid. Every crest number is
 * something you EARNED by shooting (hearts/crowns/galleries), never audience
 * size: follower/following counts are never shown, to anyone (spec §9). The pile
 * shows faces, not a number.
 */
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { CloudOff, Crown, MoreHorizontal, Settings, Share, Star, Trophy } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { imageCacheKey, signThumbs } from '@lib/cache';
import { titleForLevel } from '@lib/utils/cosmetics';
import { plural } from '@lib/utils/format';
import { isOffline } from '@lib/utils/net';
import { useNodsReceived } from '@lib/hooks/nods';
import { useFollowingPreview } from '@lib/hooks/useProfile';
import { toggleStar } from '@lib/services/archive';
import type { ProfileData, ProfileWin } from '@lib/services/profile';
import { shareProfile } from '@lib/utils/share';
import { warmImage } from '@lib/utils/warmImage';
import { levelProgress } from '@lib/utils/xp';
import { ArchiveGrid } from '@/components/ArchiveGrid';
import { PhotoDetailView } from '@/components/PhotoDetailView';
import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { FramedAvatar } from '@/components/molecules/FramedAvatar';
import { Button } from '@/components/atoms/Button';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FacePile } from '@/components/molecules/FacePile';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { StarredLightbox } from '@/components/molecules/StarredLightbox';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, frame, icons, space, typeScale } from '@/components/tokens';

type StarredItem = ProfileData['starred'][number];

type Props = {
  data: ProfileData | null;
  loading: boolean;
  onFollowToggle?: () => void;
  /** Self only — open the list of accounts you follow. */
  onOpenFollowing?: () => void;
  onSignOut?: () => void;
  onBack?: () => void;
  onMore?: () => void;
  onSettings?: () => void;
  followBusy?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Self only — Wins-empty CTA routes to the Gallery tab to go star something. */
  onExploreGallery?: () => void;
};

export function ProfileView({
  data,
  loading,
  onFollowToggle,
  onOpenFollowing,
  onSignOut,
  onBack,
  onMore,
  onSettings,
  followBusy,
  error,
  onRetry,
  onExploreGallery,
}: Props) {
  void onSignOut; // sign out now lives in the settings sheet (owned by the screen)
  const prog = levelProgress(data?.xp ?? 0);
  const title = titleForLevel(prog.level);
  const xpPct = prog.toNext > 0 ? Math.min(100, (prog.into / prog.toNext) * 100) : 0;

  // A tapped win opens in place as a fullscreen lightbox — the SAME paged viewer as
  // the gallery (no route change), so you swipe through the shelf from where you
  // tapped. Lives here so both own-profile and /u/[id] get it.
  const [viewer, setViewer] = useState<ProfileWin | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const openWin = (w: ProfileWin) => {
    setViewer(w);
    setViewerIndex(Math.max(0, data?.wins.findIndex((x) => x.id === w.id) ?? 0));
  };
  // Rotate the shelf so the tapped win is first (swipe forward, wrapping) — the same
  // model as the gallery, and it opens at index 0 so there's no initialScrollIndex
  // jump. Mapped to the viewer's PhotoDetailData shape. The shooter is this profile's
  // owner, so every page carries their name/id.
  const winPhotos = useMemo(() => {
    const wins = data?.wins ?? [];
    const idx = viewerIndex > 0 ? viewerIndex : 0;
    const ordered = idx > 0 ? [...wins.slice(idx), ...wins.slice(0, idx)] : wins;
    return ordered.map((w) => ({
      id: w.id,
      path: w.imagePath ?? w.thumbPath ?? null,
      shooter: data?.username,
      userId: data?.id,
      day: w.dayNumber,
      status: w.status,
      frame: w.frameId,
      placeholderUri: w.uri,
    }));
  }, [data?.wins, data?.username, data?.id, viewerIndex]);
  // Starred shots are private and unframed (a mix of practice free shots and
  // submissions), so they open in a plain paged photo viewer, not a framed print.
  const [starIndex, setStarIndex] = useState<number | null>(null);
  const [starBusyKeys, setStarBusyKeys] = useState<Set<string>>(new Set());
  const [starToast, setStarToast] = useState<string | null>(null);

  // Every tile here is already starred, so this only ever unstars. The RPC
  // patches the "profile:self" cache in place (see toggleStar), which drops
  // the item from data.starred and re-renders this grid without a refetch.
  const onUnstar = async (item: StarredItem) => {
    if (starBusyKeys.has(item.key)) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStarBusyKeys((s) => new Set(s).add(item.key));
    const res = await toggleStar({ id: item.key, type: item.type, imagePath: null, uri: item.uri });
    setStarBusyKeys((s) => {
      const next = new Set(s);
      next.delete(item.key);
      return next;
    });
    if (!res.ok) {
      setStarToast((await isOffline()) ? "You're offline" : 'Could not update the star');
    }
  };

  // One photo surface at a time. Starred only earns a slot once there's something
  // on it; Archive (your private journal, relocated here from its own tab per the
  // 2026-07 nav decision) is always available to yourself. Everyone else just
  // sees the wins — no segment control at all.
  const [tab, setTab] = useState<'wins' | 'starred' | 'archive'>('wins');
  const segments = useMemo(() => {
    const list: ('wins' | 'starred' | 'archive')[] = ['wins'];
    if (data?.isSelf && (data?.starred.length ?? 0) > 0) list.push('starred');
    if (data?.isSelf) list.push('archive');
    return list;
  }, [data?.isSelf, data?.starred]);
  const showSegment = segments.length > 1;
  // Archive has its own fetch (unlike Wins/Starred, which share `data`), so it
  // mounts lazily on first visit rather than eagerly with the rest of the
  // segment — but once mounted it stays mounted (see the `display: none` panes
  // below) so switching away and back never remounts its image tree. Set at
  // the tap site (below), not in an effect, to avoid a cascading re-render.
  const [archiveVisited, setArchiveVisited] = useState(false);

  // Measure the grid container so two columns + the gap never overflow into one.
  // Percentage widths ('48.8%') round up on high-density devices and push the
  // second cell onto a new row — measured pixel widths avoid that.
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth = gridWidth > 0 ? Math.floor((gridWidth - space.gridGap) / 2) : undefined;
  const onGridLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== gridWidth) setGridWidth(w);
  };

  // Open on whichever surface has content: gallery placements take time (and PotD
  // is one a day), so a shooter with no wins yet but a starred shelf should land on
  // Starred, not a blank Wins. Re-decided per profile, then the user can toggle.
  const profileId = data?.id;
  // Nods a shooter's work has earned, by tag — the craft signal ("known for
  // your light"). Closes the Nods loop: the shooter sees what curators notice.
  const craftNods = useNodsReceived(profileId);
  // Faces for the Following pile — self only, cached so it doesn't refetch on
  // every profile open. Count-free by design (spec §9): the faces are the signal.
  const following = useFollowingPreview(!!data?.isSelf);
  useEffect(() => {
    if (!data) return;
    setTab(data.isSelf && data.wins.length === 0 && data.starred.length > 0 ? 'starred' : 'wins');
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm each win's full-res under the exact cacheKey FramedPhoto reads (the signed
  // URL minus its rotating token), so opening a win is instant and sharp with no
  // thumb→full-res blink. Mirrors the gallery's warmer.
  const wins = data?.wins;
  useEffect(() => {
    const paths = (wins ?? []).map((w) => w.imagePath).filter((x): x is string => !!x);
    if (paths.length === 0) return;
    let alive = true;
    void signThumbs(paths).then((m) => {
      if (!alive) return;
      for (const url of m.values()) warmImage(url);
    });
    return () => { alive = false; };
  }, [wins]);

  // Same warming for starred full-res. These URLs are already signed, so no signing
  // pass — just seed the cache under the render's cacheKey.
  const starred = data?.starred;
  useEffect(() => {
    for (const s of starred ?? []) warmImage(s.fullUri);
  }, [starred]);

  // Own profile has no back and no title, so a full header band would be dead
  // space with a lone gear — pushing the crest down. In that case we skip the band
  // and put the gear in the crest's top-right instead, letting the crest rise up.
  const gearInCrest = !!onSettings && !onBack && !onMore;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {(onBack || onMore) && (
        <ScreenHeader
          onBack={onBack}
          right={
            <>
              {onMore && <IconButton icon={MoreHorizontal} accessibilityLabel="More" onPress={onMore} />}
              {onSettings && <IconButton icon={Settings} accessibilityLabel="Settings" onPress={onSettings} />}
            </>
          }
        />
      )}
      {error && !data && (
        <View style={styles.errorWrap}>
          <EmptyState
            icon={CloudOff}
            line="Couldn't load this profile. Check your connection."
            ctaLabel="Retry"
            onCta={onRetry}
          />
        </View>
      )}
      {!(error && !data) && (
      <ScrollView contentContainerStyle={styles.content}>
        {/* Crest — identity first: who they are and what they've earned, left
            aligned so the work below is the page, not the numbers. */}
        <View style={styles.crest}>
          <FramedAvatar
            username={data?.username ?? '·'}
            uri={data?.avatarUrl}
            frameId={data?.equippedFrame ?? 'default'}
            level={prog.level}
            size={76}
          />
          <View style={styles.crestText}>
            <View style={styles.nameRow}>
              <Text style={styles.username} numberOfLines={1}>
                {data?.username ?? ' '}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.title}>{title}</Text>
              <Mono size={typeScale.caption} color={colors.paper40}>·</Mono>
              <Mono size={typeScale.caption} color={colors.paper60}>LV {prog.level}</Mono>
            </View>
            {/* Earned-recognition strip: every number here is something you won by
                shooting (likes/crowns/galleries) — never audience size. */}
            <View style={styles.tallyRow}>
              <View style={styles.tallyItem}>
                <HeartGlyph size={11} strokeWidth={icons.strokeWidth} color={colors.heart} fill={colors.heart} />
                <Mono size={typeScale.caption} color={colors.paper60}>{data?.hearts ?? 0}</Mono>
              </View>
              <Mono size={typeScale.caption} color={colors.paper40}>·</Mono>
              <View style={styles.tallyItem}>
                <Crown size={11} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />
                <Mono size={typeScale.caption} color={colors.paper60}>{data?.crowns ?? 0}</Mono>
              </View>
              <Mono size={typeScale.caption} color={colors.paper40}>·</Mono>
              <Mono size={typeScale.caption} color={colors.paper60}>
                {data?.galleries ?? 0} {plural(data?.galleries ?? 0, 'gallery', 'galleries')}
              </Mono>
            </View>
          </View>
          {/* Own profile's settings gear + share — in-flow, pinned to the top-right of the
              crest (aligned with the avatar's top). In-flow so it always renders,
              and there's no empty header band pushing the crest down. */}
          {gearInCrest && (
            <View style={styles.crestActions}>
              <IconButton
                icon={Share}
                accessibilityLabel="Share profile"
                onPress={() => { if (data?.username) void shareProfile(data.username); }}
              />
              <IconButton
                icon={Settings}
                accessibilityLabel="Settings"
                onPress={onSettings}
              />
            </View>
          )}
        </View>

        {/* XP — a quiet hairline, self only. */}
        {data?.isSelf && !prog.atMax && (
          <View style={styles.xpWrap}>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
            </View>
            <Mono size={typeScale.caption} color={colors.paper60}>
              {prog.into}/{prog.toNext} XP
            </Mono>
          </View>
        )}

        {/* Following — the FACES you follow, not a settings-style row and never a
            count (spec §9). Self only. Empty state invites you into discovery. */}
        {data?.isSelf && onOpenFollowing && <FacePile faces={following} onPress={onOpenFollowing} />}

        {!data?.isSelf && onFollowToggle && (
          <Button
            label={data?.isFollowing ? 'Following' : 'Follow'}
            variant={data?.isFollowing ? 'ghost' : 'primary'}
            fullWidth
            loading={followBusy}
            onPress={onFollowToggle}
          />
        )}

        {craftNods.length > 0 && (
          <View style={styles.craft}>
            <Mono size={typeScale.caption} color={colors.paper40} style={styles.craftLabel}>
              {data?.isSelf ? 'WHAT CURATORS NOTICE' : 'KNOWN FOR'}
            </Mono>
            <Text style={styles.craftLine}>
              {craftNods.slice(0, 3).map((n) => `${n.label} ×${n.count}`).join('   ·   ')}
            </Text>
          </View>
        )}

        {/* Work — one surface at a time. Others just see the wins. */}
        {showSegment ? (
          <View style={styles.segment}>
            {segments.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                style={styles.segItem}
                onPress={() => {
                  setTab(t);
                  if (t === 'archive') setArchiveVisited(true);
                }}
              >
                <Mono size={typeScale.caption} weight={tab === t ? 'semibold' : 'regular'} color={tab === t ? colors.paper : colors.paper60}>
                  {t === 'wins' ? 'WINS' : t === 'starred' ? 'STARRED' : 'ARCHIVE'}
                </Mono>
                <View style={[styles.segBar, tab === t && styles.segBarOn]} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.winsHead}>
            <Mono size={typeScale.caption} color={colors.paper60}>WINS</Mono>
          </View>
        )}

        {/* All three panes stay mounted once shown, toggled with `display: none`
            instead of swapped in a type-changing ternary. Tab switches used to
            unmount the whole grid/Image tree and remount it fresh (replaying
            the crossfade transition and dropping the in-memory image cache) —
            that's what caused the flicker. `display: none` keeps every Image
            instance alive underneath. */}
        <View style={tab === 'wins' ? undefined : styles.hiddenPane}>
          {loading ? (
            <View style={styles.grid} onLayout={onGridLayout}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[cellWidth ? { width: cellWidth } : styles.winCell, styles.winSkel, styles.skeleton]} />
              ))}
            </View>
          ) : (data?.wins.length ?? 0) === 0 ? (
            <EmptyState
              icon={Trophy}
              line={data?.isSelf ? 'Your best shots live here' : 'No gallery shots yet'}
              sub={
                data?.isSelf
                  ? 'Any shot that makes the daily gallery stays here for good, not just the Photo of the Day. Star shots you love to start your shelf.'
                  : 'Shots that make the gallery show up here.'
              }
              ctaLabel={data?.isSelf ? 'Explore the gallery' : undefined}
              onCta={data?.isSelf ? onExploreGallery : undefined}
            />
          ) : (
            <View style={styles.grid} onLayout={onGridLayout}>
              {data?.wins.map((w) => (
                <Pressable
                  key={w.id}
                  accessibilityRole="button"
                  style={cellWidth ? { width: cellWidth } : styles.winCell}
                  onPress={() => openWin(w)}
                >
                  {/* No crown badge: the print carries its own status glyph. Full-res
                      over the thumb (already warmed) keeps the trophy shelf sharp. */}
                  <FramedPhoto
                    photoUri={w.fullUri ?? w.uri}
                    placeholderUri={w.uri}
                    dayNumber={w.dayNumber}
                    frameId={w.frameId}
                    status={w.status}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {showSegment && segments.includes('starred') && (
          <View style={tab === 'starred' ? undefined : styles.hiddenPane}>
            <View style={styles.grid} onLayout={onGridLayout}>
              {data?.starred.map((s, i) => (
                <Pressable key={s.key} accessibilityRole="button" style={cellWidth ? { width: cellWidth, aspectRatio: frame.aspect, backgroundColor: colors.ink2 } : styles.starCell} onPress={() => setStarIndex(i)}>
                  {s.fullUri || s.uri ? (
                    <Image
                      // Full-res over the warmed thumb placeholder — the starred wall
                      // is a viewing surface, so it must be sharp, not the 300px thumb.
                      source={s.fullUri ? { uri: s.fullUri, cacheKey: imageCacheKey(s.fullUri) } : undefined}
                      placeholder={s.uri ? { uri: s.uri, cacheKey: imageCacheKey(s.uri) } : undefined}
                      placeholderContentFit="cover"
                      style={styles.starImg}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={100}
                    />
                  ) : (
                    <View style={[styles.starImg, styles.skeleton]} />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Unstar shot"
                    hitSlop={10}
                    disabled={starBusyKeys.has(s.key)}
                    style={styles.starToggle}
                    onPress={() => void onUnstar(s)}
                  >
                    <Star size={18} strokeWidth={3.5} color="rgba(20, 18, 16, 0.55)" fill="rgba(20, 18, 16, 0.55)" style={styles.starHalo} />
                    <Star size={16} strokeWidth={icons.strokeWidth} color={colors.safelight} fill={colors.safelight} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {showSegment && segments.includes('archive') && (archiveVisited || tab === 'archive') && (
          <View style={tab === 'archive' ? undefined : styles.hiddenPane}>
            <ArchiveGrid />
          </View>
        )}

      </ScrollView>
      )}

      {/* In-place fullscreen viewer — the win zooms into the print (no route), like
          the gallery. The shooter here IS this profile's owner, so tapping the name
          just dismisses rather than navigating to the page you're already on. */}
      <Modal
        visible={viewer !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
        statusBarTranslucent
      >
        {viewer && data && (
          <PhotoDetailView
            lightbox
            id={viewer.id}
            path={viewer.imagePath ?? viewer.thumbPath ?? ''}
            placeholderUri={viewer.uri}
            shooter={data.username}
            userId={data.id}
            day={viewer.dayNumber}
            status={viewer.status}
            frame={viewer.frameId}
            onClose={() => setViewer(null)}
            onOpenProfile={() => setViewer(null)}
            // Swipe through the whole shelf, starting on the tapped win (rotated to
            // index 0). Same polished paged layout as the gallery — the bar reserve
            // keeps the frame from being cut by the nod/meta bar.
            photos={winPhotos}
            initialIndex={0}
          />
        )}
      </Modal>

      {/* Starred: a plain paged photo viewer (no print frame) — these are private
          shots, some never part of a gallery. Swipe to page the filmstrip, drag
          down to dismiss. Its own GestureHandlerRootView lives inside the Modal. */}
      <Modal
        visible={starIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStarIndex(null)}
        statusBarTranslucent
      >
        {starIndex !== null && data && (
          <StarredLightbox
            items={data.starred}
            index={starIndex}
            onClose={() => setStarIndex(null)}
            onUnstar={(item) => void onUnstar(item)}
          />
        )}
      </Modal>

      <Toast message={starToast ?? ''} visible={starToast !== null} onHide={() => setStarToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: space.gutter },
  // Crest: avatar left, identity block right.
  crest: { flexDirection: 'row', alignItems: 'center', gap: space.smPlus, paddingTop: 4 },
  // Own profile's share + gear: pinned to the crest's top edge, so it sits top-right and
  // aligns with the avatar's top rather than the vertical centre.
  crestActions: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: -2, gap: space.hair },
  crestText: { flex: 1, gap: space.hair },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { flexShrink: 1, fontFamily: fonts.sansSemiBold, fontSize: typeScale.title, color: colors.paper },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxsPlus },
  title: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  tallyRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxsPlus, marginTop: 1 },
  tallyItem: { flexDirection: 'row', alignItems: 'center', gap: space.hair },
  // XP hairline, full width and thin.
  xpWrap: { flexDirection: 'row', alignItems: 'center', gap: space.xsPlus },
  xpTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.ink2, overflow: 'hidden' },
  xpFill: { height: 3, borderRadius: 2, backgroundColor: colors.safelight },
  // Segment (Wins/Starred) — mirrors the gallery's segmented control.
  craft: { gap: space.xxsPlus, marginTop: 4 },
  craftLabel: { letterSpacing: 1.5 },
  craftLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, lineHeight: typeScale.sub * 1.35 },
  segment: { flexDirection: 'row', gap: space.lg, marginTop: 4 },
  segItem: { alignItems: 'center', gap: space.xxs },
  segBar: { height: 2, width: 18, backgroundColor: 'transparent', borderRadius: 1 },
  segBarOn: { backgroundColor: colors.safelight },
  winsHead: { flexDirection: 'row', marginTop: 4 },
  // Keeps a tab's pane (and its mounted Images) alive out of layout while
  // another tab is active, instead of unmounting it — see the tab-switch note above.
  hiddenPane: { display: 'none' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.gridGap },
  winCell: { width: '48.8%' }, // 2 columns; FramedPhoto owns the 3:4 print aspect
  winSkel: { aspectRatio: frame.aspect }, // the loader has no print to size it
  starCell: { width: '48.8%', aspectRatio: frame.aspect, backgroundColor: colors.ink2 },
  starImg: { width: '100%', height: '100%' },
  starToggle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starHalo: { position: 'absolute', top: 5, left: 5 },
  skeleton: { backgroundColor: colors.ink2 },
  errorWrap: { flex: 1, justifyContent: 'center' },
});
