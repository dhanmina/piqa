import { Crown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { PhotoTile } from '@/components/molecules/PhotoTile';
import { colors, icons, motion, space, typeScale } from '@/components/tokens';

export type GalleryPhoto = {
  id: string;
  uri?: string | null;
  hearts: number;
  isPotd?: boolean;
  /** Shooter name — shown only on the PotD cover (appreciation is signed). */
  shooter?: string;
};

type GalleryGridProps = {
  photos: GalleryPhoto[];
  /** Stagger tiles in — first reveal only, never on re-visits. */
  reveal?: boolean;
};

/**
 * The morning paper: PotD full-width first (the ONLY gold brackets in the app),
 * then an unnumbered 2-col grid. Finite by construction — galleries are bounded,
 * so this renders a plain wrapped grid, never an infinite list.
 */
export function GalleryGrid({ photos, reveal = false }: GalleryGridProps) {
  const potd = photos.find((p) => p.isPotd);
  const rest = photos.filter((p) => !p.isPotd);

  const tile = (photo: GalleryPhoto, i: number, child: ReactNode) =>
    reveal ? (
      <Animated.View
        key={photo.id}
        entering={FadeInUp.duration(300).delay(i * motion.revealStaggerMs)}
        style={styles.cell}
      >
        {child}
      </Animated.View>
    ) : (
      <View key={photo.id} style={styles.cell}>
        {child}
      </View>
    );

  return (
    <View style={styles.container}>
      {potd && (
        <View style={styles.potdBlock}>
          <Brackets color={colors.crown}>
            {/* hearts stay out of the bracket frame — they join the caption row */}
            <PhotoTile uri={potd.uri} aspectRatio={1} />
          </Brackets>
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
      <View style={styles.grid}>
        {rest.map((photo, i) =>
          tile(photo, i, <PhotoTile uri={photo.uri} hearts={photo.hearts} aspectRatio={1} />),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.gridGap,
  },
  potdBlock: {
    alignItems: 'stretch',
    marginBottom: 4,
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
