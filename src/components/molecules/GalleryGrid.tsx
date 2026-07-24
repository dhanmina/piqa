import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import type { FrameId, PhotoStatus } from '@lib/services/frames';
import { HeartButton } from '@/components/atoms/HeartButton';
import { Mono } from '@/components/atoms/Mono';
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
  /** Shooter name — shown only on the PotD cover (appreciation is signed). */
  shooter?: string;
  /** Owner id — lets the morning reveal single out the viewer's own tile. */
  userId?: string;
  /** The owner's equipped frame. Every photo in the grid wears its OWNER's. */
  frameId: FrameId;
  /** Written by close_day. The frame draws it; no screen says it again. */
  status: PhotoStatus;
  dayNumber: number;
};

type GalleryGridProps = {
  photos: GalleryPhoto[];
  /** Stagger tiles in — first reveal only, never on re-visits. */
  reveal?: boolean;
  /** Gold eyebrow above the PotD cover, e.g. "PHOTO OF THE DAY · JUL 11". */
  potdLabel?: string;
  /** During a reveal, the viewer's own tile enters last. */
  highlightUserId?: string;
  /**
   * Feed mode (Following): a flat equal-weight 2-col grid — never a single hero.
   * The magazine hero only makes sense for one day's issue (World); a cross-day
   * feed has many PotDs, so promoting one would silently drop the others. Each
   * one still wears its crown on the frame, which is how you tell them apart now.
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
 * Percentage widths ('48.8%') mix badly with a fixed-pixel gap: Yoga counts the
 * gap against available space, and the percentage rounds up per pixel-density, so
 * narrow / high-density real devices wrap to one column while emulators don't.
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
 * The morning paper: the PotD full-width first, then an unnumbered 2-col grid.
 * Finite by construction — galleries are bounded, so this is a plain wrapped
 * grid, never an infinite list.
 *
 * Every photo is a FramedPhoto, so the print itself now says what it is: the day
 * number on the rail, the owner's frame, and a gold crown in the status slot if it
 * won. That is why there are no crown badges and no gold brackets here any more —
 * they said the same thing a third time, in a different visual language.
 *
 * Anything overlaid on a photo (the heart, the shooter's name) is inset above the
 * rail, never on it. The rail is part of the print, not free canvas.
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

  // Grid-tile heart lives inside the photo window, on a bottom fade. Only the
  // glyph + count — no name (tiles are too small); count hides at 0.
  const heartOverlay = (photo: GalleryPhoto) => {
    if (!onHeart) return null;
    const c = heartCount ? heartCount(photo) : photo.hearts;
    return (
      <>
        <LinearGradient pointerEvents="none" colors={fade} style={styles.tileFade} />
        <View pointerEvents="box-none" style={styles.tileHeartOverlay}>
          <HeartButton
            onPhoto
            liked={isHearted?.(photo.id) ?? false}
            count={c > 0 ? c : undefined}
            onToggle={() => onHeart(photo)}
            size={20}
          />
        </View>
      </>
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
              {heartOverlay(p)}
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
        {heartOverlay(photo)}
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
            <Mono size={typeScale.caption} color={colors.crown} weight="medium">
              {potdLabel}
            </Mono>
          )}
          <View>
            {wrap(potd, print(potd))}
            {/* Gallery stays name-free — just the heart, like the tiles. The crown on
                the frame already marks the winner; the shooter's name shows only in
                fullscreen (photo detail). */}
            {onHeart && (
              <>
                <LinearGradient pointerEvents="none" colors={fade} style={styles.potdFade} />
                <View pointerEvents="box-none" style={styles.potdCaption}>
                  <HeartButton
                    onPhoto
                    liked={isHearted?.(potd.id) ?? false}
                    count={heartCount ? heartCount(potd) : potd.hearts}
                    onToggle={() => onHeart(potd)}
                    size={20}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      )}
      <View style={styles.grid} onLayout={onLayout}>{rest.map((photo, i) => tile(photo, i))}</View>
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
      </View>
      <View style={styles.grid} onLayout={onLayout}>
        {Array.from({ length: tiles }).map((_, i) => (
          <View key={i} style={cellStyle}>
            <View style={[styles.skelBlock, styles.skelPhoto]} />
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
    aspectRatio: frame.aspect, // the print's shape, rail included
    borderRadius: radius.photo, // 0 — a print, even while loading
  },
  skelEyebrow: {
    width: 150,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.ink2,
  },
  potdBlock: {
    alignItems: 'stretch',
    marginBottom: 4,
    gap: 8,
  },
  // Overlays stop at the top of the rail — the frame's rail is never covered. The
  // hero heart matches the grid tiles' treatment: bottom-left over a short fade.
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
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.gridGap,
  },
  cell: {
    // Fallback for the first frame only; useTwoColumn() overrides with an exact
    // floored pixel width once the grid is measured (see the hook's note).
    width: '48.8%',
  },
  tileFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: frame.window.bottom,
    height: '45%',
  },
  tileHeartOverlay: {
    position: 'absolute',
    left: 0,
    bottom: frame.window.bottom,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
});
