import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { Image } from 'expo-image';

import { Brandmark } from '@/components/atoms/Brandmark';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { colors, space, typeScale } from '@/components/tokens';
import { imageCacheKey } from '@lib/cache';

export type RecapData = {
  start_date: string;
  end_date: string;
  shot_count: number;
  gallery_count: number;
  heart_count: number;
  pick_count: number;
  potd_count: number;
  streak_days: number;
  streak_alive: boolean;
  best_shot: {
    id: string;
    day_number: number;
    is_potd: boolean;
    in_gallery: boolean;
    hearts: number;
    image_path: string | null;
    thumb_path: string | null;
  } | null;
};

type WeeklyRecapCardProps = {
  recap: RecapData;
  photoUri?: string | null;
  shooter: string;
  width?: number;
};

const SHORT_MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${SHORT_MONTH[d.getMonth()]} ${d.getDate()}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The shareable weekly recap card — a 4:5 poster summarizing one week of Piqa.
 *
 * Photo strategy: the image always renders at card-width and at least
 * clip-height — whichever is taller. This guarantees edge-to-edge coverage
 * with vertical overflow for portrait images. The user can drag vertically
 * to reposition. Short (landscape) images get ink bars top/bottom.
 */
export const WeeklyRecapCard = forwardRef<View, WeeklyRecapCardProps>(function WeeklyRecapCard(
  { recap, photoUri, shooter, width = 340 },
  ref,
) {
  const range = `${formatDate(recap.start_date)} – ${formatDate(recap.end_date)}`;
  const contentW = width - 28;

  const [clipH, setClipH] = useState(0);
  const [imageDim, setImageDim] = useState<{ w: number; h: number } | null>(null);
  const [offsetY, setOffsetY] = useState(0);

  const renderedH = imageDim
    ? Math.max(clipH, Math.round(imageDim.h * (contentW / imageDim.w)))
    : clipH;
  const overflow = Math.max(0, renderedH - clipH);
  const maxOffset = Math.floor(overflow / 2);
  const canPan = maxOffset > 0;

  const offsetRef = useRef(0);
  const maxRef = useRef(0);
  const touchRef = useRef({ startY: 0, startOffset: 0 });

  useEffect(() => { maxRef.current = maxOffset; }, [maxOffset]);

  const handleTouchStart = useCallback((e: NativeSyntheticEvent<NativeTouchEvent>) => {
    touchRef.current.startY = e.nativeEvent.pageY;
    touchRef.current.startOffset = offsetRef.current;
  }, []);

  const handleTouchMove = useCallback((e: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (maxRef.current <= 0) return;
    const dy = e.nativeEvent.pageY - touchRef.current.startY;
    const clamped = clamp(touchRef.current.startOffset + dy, -maxRef.current, maxRef.current);
    offsetRef.current = clamped;
    setOffsetY(clamped);
  }, []);

  const onImageLoad = useCallback((e: { source: { width: number; height: number } }) => {
    setImageDim({ w: e.source.width, h: e.source.height });
  }, []);

  const onClipLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setClipH(e.nativeEvent.layout.height);
  }, []);

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width }]}>
      <View style={styles.header}>
        <Mono size={11} weight="medium" color={colors.crown} style={styles.eyebrow}>
          YOUR WEEK IN PRINTS
        </Mono>
        <Mono size={11} color={colors.paper60}>{range}</Mono>
      </View>

      <View
        style={styles.photoClip}
        onLayout={onClipLayout}
        onTouchStart={canPan ? handleTouchStart : undefined}
        onTouchMove={canPan ? handleTouchMove : undefined}
      >
        {recap.best_shot && photoUri ? (
          <Image
            source={{ uri: photoUri, cacheKey: imageCacheKey(photoUri) }}
            style={[
              styles.photo,
              { height: renderedH },
              canPan && { transform: [{ translateY: -maxOffset + offsetY }] },
            ]}
            contentFit="cover"
            transition={100}
            onLoad={onImageLoad}
          />
        ) : (
          <View style={styles.emptyShot}>
            <Mono size={typeScale.sub} color={colors.paper40}>No prints this week</Mono>
          </View>
        )}
      </View>

      <View style={styles.stats}>
        <StatRow label="shots" value={recap.shot_count} />
        {recap.gallery_count > 0 && <StatRow label="in gallery" value={recap.gallery_count} />}
        {recap.heart_count > 0 && <StatRow label="hearts" value={recap.heart_count} />}
        {recap.potd_count > 0 && <StatRow label="photo of the day" value={recap.potd_count} />}
      </View>

      {recap.streak_alive && recap.streak_days > 0 && (
        <Mono size={typeScale.caption} color={colors.safelight} style={styles.streak}>
          {recap.streak_days} days with the flame
        </Mono>
      )}

      <View style={styles.credit}>
        <Text style={styles.shooter} numberOfLines={1}>
          @{shooter}
        </Text>
        <Brandmark size={16} />
      </View>
    </View>
  );
});

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={statStyles.row}>
      <Mono weight="semibold" size={typeScale.sub}>{value}</Mono>
      <Mono size={typeScale.caption} color={colors.paper60}>{label}</Mono>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.xxsPlus },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    padding: space.smPlus,
    gap: space.xsPlus,
    aspectRatio: 4 / 5,
  },
  header: {
    gap: space.hair,
  },
  eyebrow: {
    letterSpacing: 1.6,
  },
  photoClip: {
    width: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
  },
  emptyShot: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.ink2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    gap: 4,
  },
  streak: {
    marginTop: space.hair,
  },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.hair,
  },
  shooter: {
    fontFamily: displayFamily,
    fontSize: typeScale.caption,
    color: colors.paper,
    flexShrink: 1,
  },
});
