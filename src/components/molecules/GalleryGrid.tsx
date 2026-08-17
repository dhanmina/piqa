import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import type { FrameId, PhotoStatus } from '@lib/services/frames';
import { HeartButton } from '@/components/atoms/HeartButton';
import { Mono } from '@/components/atoms/Mono';
import { Brackets } from '@/components/molecules/Brackets';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';

import { colors, fade, frame, motion, radius, space, typeScale } from '@/components/tokens';

export type GalleryPhoto = {
  id: string;
  /** Signed thumb — the instant placeholder the print paints while full-res decodes. */
  uri?: string | null;
  /** Signed full-res — what the tile actually displays, so the grid is never soft. */
  fullUri?: string | null;
  hearts: number;
  isPotd?: boolean;
  /** Shooter name — shown on PotD hero credit and grid tile caption. */
  shooter?: string;
  /** Owner id — lets the morning reveal single out the viewer's own tile. */
  userId?: string;
  /** The owner's equipped frame. Every photo in the grid wears its OWNER's. */
  frameId: FrameId;
  /** Written by close_day. The frame draws it; no screen says it again. */
  status: PhotoStatus;
  dayNumber: number;
  /** Server-side content moderation label ('safe', 'nudity', 'violence', etc.). */
  contentLabel?: string | null;
};

type GalleryGridProps = {
  photos: GalleryPhoto[];
  /** Stagger tiles in — first reveal only, never on re-visits. */
  reveal?: boolean;
  /** Gold eyebrow above the PotD cover, e.g. "PHOTO OF THE DAY". */
  potdLabel?: string;
  /** During a reveal, the viewer's own tile enters last. */
  highlightUserId?: string;
  /**
   * Feed mode (Following): a flat equal-weight 2-col grid — never a single hero.
   * The magazine hero only makes sense for one day's drop (World); a cross-day
   * feed has many PotDs, so promoting one would silently drop the others.
   */
  flat?: boolean;
  onPress?: (photo: GalleryPhoto) => void;
  /** Direct hearting from the gallery. When omitted, no hearts render. */
  onHeart?: (photo: GalleryPhoto) => void;
  isHearted?: (id: string) => boolean;
  heartCount?: (photo: GalleryPhoto) => number;
};

/**
 * Two equal columns with a fixed gap. Measure the grid's own width and floor the
 * tile width so two cells + the gap can never overflow into a single column.
 */
function useTwoColumn() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };
  const tileWidth = width > 0 ? Math.floor((width - space.gridGap) / 2) : undefined;
  return { tileWidth, onLayout };
}

/**
 * The morning paper: the PotD full-width first, then an unnumbered 2-col grid
 * with photographer names on every tile.
 *
 * Design rationale (research-backed):
 * - Photographer names on tiles create social proof + connection (retention).
 * - Heart count on tiles validates community engagement (wow factor).
 * - The PotD hero is the magazine COVER — photographer credit lives below it.
 * - Section header "THE GALLERY" creates visual rhythm in the scroll.
 */
export function GalleryGrid({
  photos,
  reveal = false,
  potdLabel,
  highlightUserId,
  flat = false,
  onPress,
  onHeart,
  isHearted,
  heartCount,
}: GalleryGridProps) {
  const { tileWidth, onLayout } = useTwoColumn();
  const cellStyle = [styles.cell, tileWidth ? { width: tileWidth } : null];

  const wrap = (photo: GalleryPhoto, child: ReactNode) =>
    onPress ? (
      <Pressable accessibilityRole="button" onPress={() => onPress(photo)}>
        {child}
      </Pressable>
    ) : (
      <>{child}</>
    );

  // Grid-tile heart + name caption below the photo window, above the rail.
  const tileCaption = (photo: GalleryPhoto) => {
    const c = heartCount ? heartCount(photo) : photo.hearts;
    const hasHearts = c > 0;
    const hasName = !!photo.shooter;
    if (!onHeart && !hasName) return null;
    return (
      <View style={styles.tileCaption}>
        <View style={styles.tileCaptionLeft}>
          {hasName && (
            <Mono size={typeScale.caption} color={colors.paper60} numberOfLines={1}>
              {photo.shooter}
            </Mono>
          )}
        </View>
        {onHeart && (
          <HeartButton
            onPhoto
            liked={isHearted?.(photo.id) ?? false}
            count={hasHearts ? c : undefined}
            onToggle={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onHeart(photo);
            }}
            size={16}
          />
        )}
      </View>
    );
  };

  // Display full-res over the thumb: the thumb paints instantly as the placeholder
  // and the sharp full-res crossfades in (already warmed into cache by the gallery
  // screen, so no extra fetch). Falls back to the thumb when there's no full-res.
  const print = (photo: GalleryPhoto) => (
    <FramedPhoto
      photoUri={photo.fullUri ?? photo.uri}
      placeholderUri={photo.uri}
      dayNumber={photo.dayNumber}
      frameId={photo.frameId}
      status={photo.status}
    />
  );

  if (flat) {
    return (
      <View style={styles.container}>
        <View style={styles.grid} onLayout={onLayout}>
          {photos.map((p) => (
            <View key={p.id} style={cellStyle}>
              {wrap(p, print(p))}
              {tileCaption(p)}
            </View>
          ))}
        </View>
      </View>
    );
  }

  const potd = photos.find((p) => p.isPotd);
  let rest = photos.filter((p) => !p.isPotd);

  // Reveal choreography: the viewer's own tile enters LAST.
  const ownIdx = highlightUserId ? rest.findIndex((p) => p.userId === highlightUserId) : -1;
  if (reveal && ownIdx >= 0) {
    const [own] = rest.splice(ownIdx, 1);
    rest = [...rest, own];
  }

  const tile = (photo: GalleryPhoto, i: number) => {
    const body = (
      <>
        {wrap(photo, print(photo))}
        {tileCaption(photo)}
      </>
    );
    return reveal ? (
      <Animated.View
        key={photo.id}
        entering={FadeInUp.duration(300).delay(i * motion.revealStaggerMs)}
        style={cellStyle}
      >
        {body}
      </Animated.View>
    ) : (
      <View key={photo.id} style={cellStyle}>
        {body}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {potd && (
        <View style={styles.potdBlock}>
          {potdLabel && (
            <Mono size={typeScale.caption} color={colors.crown} weight="medium" style={styles.potdEyebrow}>
              {potdLabel}
            </Mono>
          )}
          <Brackets color={colors.crown} animated gap={4}>
            <View>
              {wrap(potd, print(potd))}
              {onHeart && (
                <>
                  <LinearGradient pointerEvents="none" colors={fade} style={styles.potdFade} />
                  <View pointerEvents="box-none" style={styles.potdCaption}>
                    <HeartButton
                      onPhoto
                      liked={isHearted?.(potd.id) ?? false}
                      count={heartCount ? heartCount(potd) : potd.hearts}
                      onToggle={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onHeart(potd);
                      }}
                      size={20}
                    />
                  </View>
                </>
              )}
            </View>
          </Brackets>
          {potd.shooter && (
            <Mono size={typeScale.caption} color={colors.paper60} style={styles.potdCredit}>
              {potd.shooter}
            </Mono>
          )}
        </View>
      )}

      {rest.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionRule} />
            <Mono size={typeScale.caption} color={colors.paper40} weight="medium" style={styles.sectionLabel}>
              THE GALLERY
            </Mono>
            <View style={styles.sectionRule} />
          </View>
          <View style={styles.grid} onLayout={onLayout}>
            {rest.map((photo, i) => tile(photo, i))}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Loading placeholder that mirrors the gallery's real shape — a full-width PotD
 * cover over a 2-col tile grid. Flat ink2, no shimmer (spec §11d).
 */
export function GalleryGridSkeleton({ tiles = 6 }: { tiles?: number }) {
  const { tileWidth, onLayout } = useTwoColumn();
  const cellStyle = [styles.cell, tileWidth ? { width: tileWidth } : null];
  return (
    <View style={styles.container} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.potdBlock}>
        <View style={styles.skelEyebrow} />
        <View style={[styles.skelBlock, styles.skelPhoto]} />
        <View style={styles.skelCreditLine} />
      </View>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionRule} />
        <View style={styles.skelSectionLabel} />
        <View style={styles.sectionRule} />
      </View>
      <View style={styles.grid} onLayout={onLayout}>
        {Array.from({ length: tiles }).map((_, i) => (
          <View key={i} style={cellStyle}>
            <View style={[styles.skelBlock, styles.skelPhoto]} />
            <View style={styles.skelCaptionLine} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.gridGap,
  },
  skelBlock: {
    backgroundColor: colors.ink2,
  },
  skelPhoto: {
    width: '100%',
    aspectRatio: frame.aspect,
    borderRadius: radius.photo,
  },
  skelEyebrow: {
    width: 150,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.ink2,
  },
  skelCreditLine: {
    width: 80,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.ink2,
    marginTop: space.hair,
  },
  skelCaptionLine: {
    width: 60,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.ink2,
    marginTop: space.xxsPlus,
  },
  skelSectionLabel: {
    width: 90,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.ink2,
  },
  potdBlock: {
    alignItems: 'stretch',
    marginBottom: 4,
    gap: 8,
  },
  potdEyebrow: {
    letterSpacing: 1.5,
  },
  potdCredit: {
    letterSpacing: 0.5,
    paddingLeft: space.hair,
  },
  potdFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: frame.window.bottom,
    height: '45%',
  },
  potdCaption: {
    position: 'absolute',
    left: 0,
    bottom: frame.window.bottom,
    paddingHorizontal: space.smPlus,
    paddingBottom: space.xsPlus,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.paper30,
  },
  sectionLabel: {
    letterSpacing: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.gridGap,
  },
  cell: {
    width: '48.8%',
  },
  tileCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.xxsPlus,
    paddingBottom: space.hair,
  },
  tileCaptionLeft: {
    flex: 1,
    marginRight: 8,
  },
});
