import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Flag, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { imageCacheKey } from '@lib/cache';
import { IconButton } from '@/components/atoms/IconButton';
import { colors, fonts, icons, overlay, radius, typeScale } from '@/components/tokens';

type MatchupPairProps = {
  topUri: string;
  bottomUri: string;
  /** 1-based position within the set, e.g. 7 of 10. */
  index: number;
  total: number;
  /** The theme being judged — shown so the pick is about fit, not just looks. */
  theme?: string | null;
  onPick?: (winner: 'top' | 'bottom') => void;
  onSkip?: () => void;
  /** Report the offending photo. A tap on top of the photo, never a pick. */
  onReport?: (which: 'top' | 'bottom') => void;
  onClose?: () => void;
};

const EDGE = 20; // generous corner clearance so no chip kisses a rounded corner

/**
 * The most disciplined screen in the app (spec §6): two photos, one choice.
 * Blind = frameless — no brackets, names, or hearts. Each print is contained so
 * the whole composition is judged, floating on a blurred, dimmed echo of itself
 * so a portrait shot never sits on hard black bars. Tap a photo to pick: it
 * lights up in the accent and lifts while the other dims.
 *
 * Chrome is anchored, not scattered: a soft top scrim gives the top row (close ·
 * progress · report) consistent contrast; skip sits in the bottom thumb zone;
 * report lives at each photo's outer-right corner. Everything shares one chip
 * language and keeps EDGE clearance from the screen edges.
 */
export const MatchupPair = React.memo(function MatchupPair({ topUri, bottomUri, index, total, theme, onPick, onSkip, onReport, onClose }: MatchupPairProps) {
  const insets = useSafeAreaInsets();

  const topSel = useSharedValue(0);
  const botSel = useSharedValue(0);
  const topDim = useSharedValue(0);
  const botDim = useSharedValue(0);

  const topLift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + topSel.value * 0.03 }] }));
  const botLift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + botSel.value * 0.03 }] }));
  const topGlow = useAnimatedStyle(() => ({ opacity: topSel.value }));
  const botGlow = useAnimatedStyle(() => ({ opacity: botSel.value }));
  const topDimStyle = useAnimatedStyle(() => ({ opacity: topDim.value * 0.55 }));
  const botDimStyle = useAnimatedStyle(() => ({ opacity: botDim.value * 0.55 }));

  const pick = (which: 'top' | 'bottom') => {
    const sel = which === 'top' ? topSel : botSel;
    const dim = which === 'top' ? botDim : topDim;
    sel.value = withSequence(withTiming(1, { duration: 110 }), withTiming(0.7, { duration: 160 }));
    dim.value = withTiming(1, { duration: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPick?.(which);
  };

  const half = (which: 'top' | 'bottom', uri: string, lift: object, glow: object, dimStyle: object) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pick ${which} photo`}
      style={styles.photo}
      onPress={() => pick(which)}
    >
      {/* Ambient matte: a blurred, darkened fill of the same shot, so the print
          floats on its own light instead of hard black side-bars. */}
      <Image source={{ uri, cacheKey: imageCacheKey(uri) }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
      <View pointerEvents="none" style={styles.matte} />
      {/* The sharp print — contained, whole composition visible. */}
      <Animated.View style={[StyleSheet.absoluteFill, lift]}>
        <Image source={{ uri, cacheKey: imageCacheKey(uri) }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, glow]} />
    </Pressable>
  );

  const reportChip = (which: 'top' | 'bottom') =>
    onReport ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Report ${which} photo`}
        hitSlop={10}
        style={styles.chip}
        onPress={() => onReport(which)}
      >
        <Flag size={15} strokeWidth={icons.strokeWidth} color={colors.paper} />
      </Pressable>
    ) : null;

  return (
    <View style={styles.container}>
      {half('top', topUri, topLift, topGlow, topDimStyle)}
      <View style={styles.divider} />
      {half('bottom', bottomUri, botLift, botGlow, botDimStyle)}

      {/* Anchors: soft scrims give the floating chrome consistent contrast. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(12,11,10,0.55)', 'rgba(12,11,10,0)']}
        style={[styles.topScrim, { height: insets.top + 72 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(12,11,10,0)', 'rgba(12,11,10,0.5)']}
        style={[styles.bottomScrim, { height: insets.bottom + 68 }]}
      />

      {/* Top row: close · progress · report(top) — evenly balanced, one language. */}
      <View pointerEvents="box-none" style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.barSide}>
          {onClose && <IconButton icon={X} variant="chrome" accessibilityLabel="Close" onPress={onClose} />}
        </View>
        <View style={styles.progressPill}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.seg, i < index ? styles.segDone : styles.segPending]} />
          ))}
        </View>
        <View style={[styles.barSide, styles.barRight]}>{reportChip('top')}</View>
      </View>

      {/* The brief, centered under the top bar: curation stays blind to the
          shooter, never to the theme — so every pick judges fit, not just looks. */}
      {theme ? (
        <View pointerEvents="none" style={[styles.themeWrap, { top: insets.top + 52 }]}>
          <Text style={styles.themeChip} numberOfLines={2}>
            {theme}
          </Text>
        </View>
      ) : null}

      {/* Report(bottom) at the bottom photo's outer corner. */}
      <View pointerEvents="box-none" style={[styles.bottomRight, { bottom: insets.bottom + 16 }]}>
        {reportChip('bottom')}
      </View>

      {/* Skip in the bottom thumb zone — secondary, out of the top row. */}
      <View pointerEvents="box-none" style={[styles.skipRow, { bottom: insets.bottom + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip this pair" hitSlop={12} style={styles.skipChip} onPress={onSkip}>
          <Text style={styles.skip}>skip</Text>
        </Pressable>
      </View>

      {/* One-time affordance: the interface is blind, so nothing else says the
          photo is the button. Shown only on the first pair. */}
      {index === 1 && (
        <View pointerEvents="none" style={styles.hintWrap}>
          <Text style={styles.hint}>Tap a photo to choose</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  photo: {
    flex: 1,
    backgroundColor: colors.ink,
    overflow: 'hidden', // clip the pick lift + blurred matte to the half
  },
  matte: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,11,10,0.5)' },
  glow: { borderWidth: 2.5, borderColor: colors.safelight },
  dim: { backgroundColor: colors.ink },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper40 },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  topBar: {
    position: 'absolute',
    left: EDGE,
    right: EDGE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  barRight: { justifyContent: 'flex-end' },
  progressPill: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: overlay.chip,
  },
  seg: { width: 10, height: 4, borderRadius: 2 },
  segDone: { backgroundColor: colors.safelight },
  segPending: { backgroundColor: colors.paper40 },
  // One chip language for the corner controls.
  chip: { padding: 8, borderRadius: radius.pill, backgroundColor: overlay.chip },
  themeWrap: { position: 'absolute', left: EDGE, right: EDGE, alignItems: 'center' },
  themeChip: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper,
    textAlign: 'center',
    maxWidth: '90%',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: overlay.chip,
    overflow: 'hidden',
  },
  bottomRight: { position: 'absolute', right: EDGE, flexDirection: 'row', justifyContent: 'flex-end' },
  skipRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  skipChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: overlay.chip,
  },
  skip: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  hintWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: overlay.chip,
    overflow: 'hidden',
  },
});
