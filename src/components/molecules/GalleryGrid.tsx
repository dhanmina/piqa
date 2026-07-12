import { Crown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { colors, icons, motion, photo as photoFrame, radius, space, typeScale } from '@/components/tokens';

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
  onPress?: (photo: GalleryPhoto) => void;
};

/**
 * The morning paper: PotD full-width first (the ONLY gold brackets in the app),
 * then an unnumbered 2-col grid. Finite by construction — galleries are bounded,
 * so this renders a plain wrapped grid, never an infinite list.
 */
export function GalleryGrid({ photos, reveal = false, potdLabel, highlightUserId, onPress }: GalleryGridProps) {
  const potd = photos.find((p) => p.isPotd);
  let rest = photos.filter((p) => !p.isPotd);

  // Reveal choreography: the viewer's own tile enters LAST, framed in gold.
  const ownIdx = highlightUserId ? rest.findIndex((p) => p.userId === highlightUserId) : -1;
  if (reveal && ownIdx >= 0) {
    const [own] = rest.splice(ownIdx, 1);
    rest = [...rest, own];
  }

  const wrap = (photo: GalleryPhoto, child: ReactNode) =>
    onPress ? (
      <Pressable accessibilityRole="button" onPress={() => onPress(photo)}>
        {child}
      </Pressable>
    ) : (
      <>{child}</>
    );

  const tile = (photo: GalleryPhoto, i: number, isOwn: boolean) => {
    const inner = isOwn ? (
      <Brackets color={colors.crown}>
        <PhotoTile uri={photo.uri} hearts={photo.hearts} aspectRatio={photoFrame.aspect} />
      </Brackets>
    ) : (
      <PhotoTile uri={photo.uri} hearts={photo.hearts} aspectRatio={photoFrame.aspect} />
    );
    const body = wrap(photo, inner);
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
              {/* hearts stay out of the bracket frame — they join the caption row */}
              <PhotoTile uri={potd.uri} aspectRatio={photoFrame.aspect} />
            </Brackets>,
          )}
          <View style={styles.potdCaption}>
            <Crown size={16} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />
            {potd.shooter && <Text style={styles.shooter}>{potd.shooter}</Text>}
            <View style={styles.potdHearts}>
              <HeartGlyph size={13} color={colors.paper60} strokeWidth={2} />
              <Mono size={typeScale.caption} color={colors.paper60}>
                {potd.hearts}
              </Mono>
            </View>
          </View>
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
  potdCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  shooter: {
    fontFamily: displayFamily,
    fontSize: typeScale.body,
    color: colors.paper,
  },
  potdHearts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.gridGap,
  },
  cell: {
    width: '48.8%', // 2 columns with the 8dp gap
  },
});
