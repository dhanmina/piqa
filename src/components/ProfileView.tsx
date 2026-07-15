/**
 * Profile — same layout own/others (spec §11c). Identity-first: a left-aligned
 * crest (avatar+frame · name+streak · title·level · galleries·crowns) over a
 * quiet XP hairline, then the work — a Wins/Starred segment above a 2-column
 * print grid. Metrics are whispered, not a headline; follower/following counts
 * are never shown, to anyone (spec §9).
 */
import { Image } from 'expo-image';
import { ChevronLeft, CloudOff, Crown, Flame, MoreHorizontal, Settings, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { imageCacheKey, signThumbs } from '@lib/cache';
import { ringForLevel, titleForLevel } from '@lib/cosmetics';
import { plural } from '@lib/format';
import type { ProfileData, ProfileWin } from '@lib/profile';
import { levelProgress } from '@lib/xp';
import { PhotoDetailView } from '@/components/PhotoDetailView';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { StarredLightbox } from '@/components/molecules/StarredLightbox';
import { colors, fonts, frame, icons, space, typeScale } from '@/components/tokens';

type Props = {
  data: ProfileData | null;
  loading: boolean;
  onFollowToggle?: () => void;
  onSignOut?: () => void;
  onBack?: () => void;
  onMore?: () => void;
  onSettings?: () => void;
  followBusy?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

export function ProfileView({ data, loading, onFollowToggle, onSignOut, onBack, onMore, onSettings, followBusy, error, onRetry }: Props) {
  void onSignOut; // sign out now lives in the settings sheet (owned by the screen)
  const prog = levelProgress(data?.xp ?? 0);
  const ring = ringForLevel(prog.level);
  const title = titleForLevel(prog.level);
  const xpPct = prog.toNext > 0 ? Math.min(100, (prog.into / prog.toNext) * 100) : 0;

  // A tapped win opens in place as a fullscreen lightbox — the same feel as the
  // gallery, no route change. Lives here so both own-profile and /u/[id] get it.
  const [viewer, setViewer] = useState<ProfileWin | null>(null);
  // Starred shots are private and unframed (a mix of practice free shots and
  // submissions), so they open in a plain paged photo viewer, not a framed print.
  const [starIndex, setStarIndex] = useState<number | null>(null);

  // One photo surface at a time. Starred is a self-only shelf, so the segment
  // only appears when there's something on it; everyone else just sees the wins.
  const [tab, setTab] = useState<'wins' | 'starred'>('wins');
  const showSegment = !!data?.isSelf && (data?.starred.length ?? 0) > 0;

  // Open on whichever surface has content: gallery placements take time (and PotD
  // is one a day), so a shooter with no wins yet but a starred shelf should land on
  // Starred, not a blank Wins. Re-decided per profile, then the user can toggle.
  const profileId = data?.id;
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
      for (const url of m.values()) {
        void Image.loadAsync({ uri: url, cacheKey: imageCacheKey(url) }).catch(() => {});
      }
    });
    return () => {
      alive = false;
    };
  }, [wins]);

  // Same warming for starred full-res. These URLs are already signed, so no signing
  // pass — just seed the cache under the render's cacheKey.
  const starred = data?.starred;
  useEffect(() => {
    for (const s of starred ?? []) {
      if (s.fullUri) void Image.loadAsync({ uri: s.fullUri, cacheKey: imageCacheKey(s.fullUri) }).catch(() => {});
    }
  }, [starred]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {(onBack || onMore || onSettings) && (
        <View style={styles.backHeader}>
          {onBack ? <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={onBack} /> : <View />}
          {onMore && <IconButton icon={MoreHorizontal} accessibilityLabel="More" onPress={onMore} />}
          {onSettings && <IconButton icon={Settings} accessibilityLabel="Settings" onPress={onSettings} />}
        </View>
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
          <Avatar
            username={data?.username ?? '·'}
            uri={data?.avatarUrl}
            size={64}
            ringColor={ring.color}
            ringWidth={ring.width}
          />
          <View style={styles.crestText}>
            <View style={styles.nameRow}>
              <Text style={styles.username} numberOfLines={1}>
                {data?.username ?? ' '}
              </Text>
              {(data?.streakWeeks ?? 0) > 0 && (
                <View style={styles.flame}>
                  <Flame size={13} strokeWidth={icons.strokeWidth} color={colors.safelight} fill={colors.safelight} />
                  <Mono size={typeScale.caption} color={colors.safelight}>
                    {data!.streakWeeks}w
                  </Mono>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.title}>{title}</Text>
              <Mono size={typeScale.caption} color={colors.paper40}>·</Mono>
              <Mono size={typeScale.caption} color={colors.paper60}>LV {prog.level}</Mono>
            </View>
            <View style={styles.tallyRow}>
              <Mono size={typeScale.caption} color={colors.paper60}>
                {data?.galleries ?? 0} {plural(data?.galleries ?? 0, 'gallery', 'galleries')}
              </Mono>
              <Mono size={typeScale.caption} color={colors.paper40}>·</Mono>
              <View style={styles.tallyCrown}>
                <Crown size={11} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />
                <Mono size={typeScale.caption} color={colors.paper60}>{data?.crowns ?? 0}</Mono>
              </View>
            </View>
          </View>
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

        {!data?.isSelf && onFollowToggle && (
          <Button
            label={data?.isFollowing ? 'Following' : 'Follow'}
            variant={data?.isFollowing ? 'ghost' : 'primary'}
            fullWidth
            loading={followBusy}
            onPress={onFollowToggle}
          />
        )}

        {/* Work — one surface at a time. Others just see the wins. */}
        {showSegment ? (
          <View style={styles.segment}>
            {(['wins', 'starred'] as const).map((t) => (
              <Pressable key={t} accessibilityRole="button" style={styles.segItem} onPress={() => setTab(t)}>
                <Mono size={typeScale.caption} weight={tab === t ? 'semibold' : 'regular'} color={tab === t ? colors.paper : colors.paper60}>
                  {t === 'wins' ? 'WINS' : 'STARRED'}
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

        {showSegment && tab === 'starred' ? (
          <View style={styles.grid}>
            {data?.starred.map((s, i) => (
              <Pressable key={s.key} accessibilityRole="button" style={styles.starCell} onPress={() => setStarIndex(i)}>
                {s.uri ? (
                  <Image source={{ uri: s.uri, cacheKey: imageCacheKey(s.uri) }} style={styles.starImg} contentFit="cover" />
                ) : (
                  <View style={[styles.starImg, styles.skeleton]} />
                )}
              </Pressable>
            ))}
          </View>
        ) : loading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.winCell, styles.winSkel, styles.skeleton]} />
            ))}
          </View>
        ) : (data?.wins.length ?? 0) === 0 ? (
          <View style={styles.winsEmpty}>
            <Trophy size={28} strokeWidth={icons.strokeWidth} color={colors.paper40} />
            <Text style={styles.winsLine}>{data?.isSelf ? 'Your best shots live here' : 'No gallery shots yet'}</Text>
            <Text style={styles.winsSub}>
              {data?.isSelf
                ? 'Any shot that makes the daily gallery stays here for good, not just the Photo of the Day. Star shots you love to start your shelf.'
                : 'Shots that make the gallery show up here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {data?.wins.map((w) => (
              <Pressable
                key={w.id}
                accessibilityRole="button"
                style={styles.winCell}
                onPress={() => setViewer(w)}
              >
                {/* No crown badge: the print carries its own status glyph. */}
                <FramedPhoto
                  photoUri={w.uri}
                  dayNumber={w.dayNumber}
                  frameId={data.equippedFrame}
                  status={w.status}
                />
              </Pressable>
            ))}
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
            frame={data.equippedFrame}
            onClose={() => setViewer(null)}
            onOpenProfile={() => setViewer(null)}
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
          <StarredLightbox items={data.starred} index={starIndex} onClose={() => setStarIndex(null)} />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  backHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  content: { padding: space.gutter, gap: space.gutter },
  // Crest: avatar left, identity block right.
  crest: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  crestText: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { flexShrink: 1, fontFamily: fonts.sansSemiBold, fontSize: typeScale.title, color: colors.paper },
  flame: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  tallyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  tallyCrown: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // XP hairline, full width and thin.
  xpWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xpTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.ink2, overflow: 'hidden' },
  xpFill: { height: 3, borderRadius: 2, backgroundColor: colors.safelight },
  // Segment (Wins/Starred) — mirrors the gallery's segmented control.
  segment: { flexDirection: 'row', gap: 22, marginTop: 4 },
  segItem: { alignItems: 'center', gap: 5 },
  segBar: { height: 2, width: 18, backgroundColor: 'transparent', borderRadius: 1 },
  segBarOn: { backgroundColor: colors.safelight },
  winsHead: { flexDirection: 'row', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.gridGap },
  winCell: { width: '48.8%' }, // 2 columns; FramedPhoto owns the 3:4 print aspect
  winSkel: { aspectRatio: frame.aspect }, // the loader has no print to size it
  starCell: { width: '48.8%', aspectRatio: frame.aspect, backgroundColor: colors.ink2 },
  starImg: { width: '100%', height: '100%' },
  skeleton: { backgroundColor: colors.ink2 },
  errorWrap: { flex: 1, justifyContent: 'center' },
  winsEmpty: { alignItems: 'center', gap: 10, paddingVertical: space.gutter * 2 },
  winsLine: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.paper },
  winsSub: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60, textAlign: 'center' },
});
