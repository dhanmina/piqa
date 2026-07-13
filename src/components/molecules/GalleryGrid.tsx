import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { HeartButton } from '@/components/atoms/HeartButton';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { colors, fade, icons, motion, photo as photoFrame, radius, space, typeScale } from '@/components/tokens';

export type GalleryPhoto = {
  id: string;
  uri?: string | null;
  hearts: number;
  isPotd?: boolean;
  /** Shooter name — shown only on the PotD cover (appreciation is signed). */
  shooter?: string;
  /** Owner id — lets the morning reveal single out the viewer's own tile. */
  userId?: string;
};

type GalleryGridProps = {
  photos: GalleryPhoto[];
  /** Stagger tiles in — first reveal only, never on re-visits. */
  reveal?: boolean;
  /** Gold eyebrow above the PotD cover, e.g. "PHOTO OF THE DAY · JUL 11". */
  potdLabel?: string;
  /** During a reveal, the viewer's own tile enters last with gold brackets. */
  highlightUserId?: string;
  /**
   * Feed mode (Following): a flat equal-weight 2-col grid with a crown badge on
   * each PotD tile — never a single hero. The magazine hero only makes sense for
   * one day's issue (World); a cross-day feed has many PotDs, so promoting one
   * would silently drop the others.
   */
  flat?: boolean;
  onPress?: (photo: GalleryPhoto) => void;
  /** Direct hearting from the gallery (grid tiles show only the heart; the PotD
   *  hero shows crown + name + heart). When omitted, no hearts render. */
  onHeart?: (photo: GalleryPhoto) => void;
  isHearted?: (id: string) => boolean;
  heartCount?: (photo: GalleryPhoto) => number;
};

/**
 * The morning paper: PotD full-width first (the ONLY gold brackets in the app),
 * then an unnumbered 2-col grid. Finite by construction — galleries are bounded,
 * so this renders a plain wrapped grid, never an infinite list. In `flat` mode
 * (Following feed) it drops the hero and renders every placement as an equal
 * tile, crown-badged if it was a Photo of the Day.
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
  const wrap = (photo: GalleryPhoto, child: ReactNode) =>
    onPress ? (
      <Pressable accessibilityRole="button" onPress={() => onPress(photo)}>
        {child}
      </Pressable>
    ) : (
      <>{child}</>
    );

  // Grid-tile heart lives INSIDE the photo, on a bottom fade (like the PotD).
  // Only the glyph + count — no name (tiles are too small); count hides at 0.
  const heartOverlay = (photo: GalleryPhoto) => {
    if (!onHeart) return null;
    const c = heartCount ? heartCount(photo) : photo.hearts;
    return (
      <>
        <LinearGradient
          pointerEvents="none"
          colors={fade}
          style={styles.tileFade}
        />
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

  if (flat) {
    return (
      <View style={styles.container}>
        <View style={styles.grid}>
          {photos.map((p) => (
            <View key={p.id} style={styles.cell}>
              {wrap(p, <PhotoTile uri={p.uri} badge={p.isPotd ? 'crown' : undefined} aspectRatio={photoFrame.aspect} />)}
              {heartOverlay(p)}
            </View>
          ))}
        </View>
      </View>
    );
  }

  const potd = photos.find((p) => p.isPotd);
  let rest = photos.filter((p) => !p.isPotd);

  // Reveal choreography: the viewer's own tile enters LAST, framed in gold.
  const ownIdx = highlightUserId ? rest.findIndex((p) => p.userId === highlightUserId) : -1;
  if (reveal && ownIdx >= 0) {
    const [own] = rest.splice(ownIdx, 1);
    rest = [...rest, own];
  }

  const tile = (photo: GalleryPhoto, i: number, isOwn: boolean) => {
    const inner = isOwn ? (
      <Brackets color={colors.crown}>
        <PhotoTile uri={photo.uri} aspectRatio={photoFrame.aspect} />
      </Brackets>
    ) : (
      <PhotoTile uri={photo.uri} aspectRatio={photoFrame.aspect} />
    );
    const body = (
      <>
        {wrap(photo, inner)}
        {heartOverlay(photo)}
      </>
    );
    return reveal ? (
      <Animated.View key={photo.id} entering={FadeInUp.duration(300).delay(i * motion.revealStaggerMs)} style={styles.cell}>
        {body}
      </Animated.View>
    ) : (
      <View key={photo.id} style={styles.cell}>
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
          {wrap(
            potd,
            <Brackets color={colors.crown}>
              <View style={styles.potdPhoto}>
                {potd.uri ? (
                  <Image source={{ uri: potd.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={100} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.skelBlock]} />
                )}
                {/* Bottom fade so the caption reads over the photo — a legibility
                    scrim, like the detail view; the winner's credit lives on the cover. */}
                <LinearGradient
                  pointerEvents="none"
                  colors={fade}
                  style={styles.potdFade}
                />
                <View style={styles.potdCaption}>
                  <View style={styles.potdWho}>
                    <Crown size={20} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />
                    {potd.shooter && (
                      <Text style={styles.shooter} numberOfLines={1}>
                        {potd.shooter}
                      </Text>
                    )}
                  </View>
                  {onHeart && (
                    <HeartButton
                      onPhoto
                      liked={isHearted?.(potd.id) ?? false}
                      count={heartCount ? heartCount(potd) : potd.hearts}
                      onToggle={() => onHeart(potd)}
                      size={20}
                    />
                  )}
                </View>
              </View>
            </Brackets>,
          )}
        </View>
      )}
      <View style={styles.grid}>{rest.map((photo, i) => tile(photo, i, reveal && ownIdx >= 0 && i === rest.length - 1))}</View>
    </View>
  );
}

/**
 * Loading placeholder that mirrors the gallery's real shape — a full-width PotD
 * cover over a 2-col tile grid — instead of one flat block. Flat ink2, no
 * shimmer (spec §11d: "skeleton = ink2, no shimmer").
 */
export function GalleryGridSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <View style={styles.container} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.potdBlock}>
        <View style={styles.skelEyebrow} />
        <View style={[styles.skelBlock, styles.skelPhoto]} />
        <View style={styles.skelCaption} />
      </View>
      <View style={styles.grid}>
        {Array.from({ length: tiles }).map((_, i) => (
          <View key={i} style={styles.cell}>
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
    aspectRatio: photoFrame.aspect,
    borderRadius: radius.photo, // 0 — a print, even while loading
  },
  skelEyebrow: {
    width: 150,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.ink2,
  },
  skelCaption: {
    alignSelf: 'center',
    width: 110,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.ink2,
  },
  potdBlock: {
    alignItems: 'stretch',
    marginBottom: 4,
    gap: 8,
  },
  potdPhoto: {
    width: '100%',
    aspectRatio: photoFrame.aspect,
    backgroundColor: colors.ink2,
  },
  potdFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  potdCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  potdWho: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  shooter: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.gridGap,
  },
  cell: {
    width: '48.8%', // 2 columns with the 8dp gap
  },
  tileFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  tileHeartOverlay: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
});
