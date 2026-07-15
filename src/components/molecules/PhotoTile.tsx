import { Image } from 'expo-image';
import { Crown, RefreshCw } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { imageCacheKey } from '@lib/cache';
import { HeartGlyph } from '@/components/atoms/HeartGlyph';
import { Mono } from '@/components/atoms/Mono';
import { colors, icons, overlay, photo, radius, typeScale } from '@/components/tokens';

type PhotoTileBadge = 'crown' | 'daily' | 'queued';

type PhotoTileProps = {
  uri?: string | null;
  /** Rendered BELOW the photo, never on it — the print stays untouched. */
  hearts?: number;
  badge?: PhotoTileBadge;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
};

/** Mini bracket tick — marks a Daily Shot entry in the archive. */
function BracketMini({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Path d="M1 4 V1 H4 M8 1 H11 V4 M11 8 V11 H8 M4 11 H1 V8" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

/**
 * Photos are prints: 0 radius, always. Skeleton = flat ink2, no shimmer.
 * Corner badges (crown / daily / queued ↻) may sit on the image; heart counts
 * may NOT — they render in a mono caption row under the tile.
 * "queued ↻" is a first-class state — offline never looks like an error.
 */
export function PhotoTile({ uri, hearts, badge, aspectRatio = photo.aspect, style }: PhotoTileProps) {
  return (
    <View style={style}>
      <View style={[styles.photoBox, { aspectRatio }]}>
        {uri ? (
          <Image
            source={{ uri, cacheKey: imageCacheKey(uri) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={100}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.skeleton]} />
        )}

        {badge && (
          <View style={styles.badge}>
            {badge === 'crown' && (
              <Crown size={14} strokeWidth={icons.strokeWidth} color={colors.crown} fill={colors.crown} />
            )}
            {badge === 'daily' && <BracketMini color={colors.paper} />}
            {badge === 'queued' && (
              <View style={styles.queuedRow}>
                <RefreshCw size={11} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                <Mono size={10} color={colors.paper60}>
                  queued
                </Mono>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Only surface a count when there's something to show — a "0" under
          every tile is what made the grid feel busy. */}
      {hearts !== undefined && hearts > 0 && (
        <View style={styles.heartsRow}>
          <HeartGlyph size={12} color={colors.paper60} />
          <Mono size={typeScale.caption} color={colors.paper60}>
            {hearts}
          </Mono>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoBox: {
    borderRadius: radius.photo, // 0 — never round a photo
    overflow: 'hidden',
    backgroundColor: colors.ink2,
  },
  skeleton: {
    backgroundColor: colors.ink2,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: overlay.badge,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  queuedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingTop: 6,
  },
});
