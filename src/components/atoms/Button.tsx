import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors, fonts, motion, radius, space, typeScale } from '@/components/tokens';

type ButtonVariant = 'primary' | 'ghost' | 'text';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
};

/**
 * Primary = the safelight pill, max ONE per screen.
 * Loading state: mono ellipsis with the width locked so the pill never resizes.
 * Press = scale 0.97 + light haptic; no ripples anywhere.
 */
export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false }: ButtonProps) {
  const [lockedWidth, setLockedWidth] = useState<number | undefined>(undefined);
  const [dotCount, setDotCount] = useState(3);
  const widthRef = useRef<number>(0);

  useEffect(() => {
    if (!loading) return;
    setLockedWidth(widthRef.current || undefined);
    const id = setInterval(() => {
      setDotCount((n) => (n >= 3 ? 1 : n + 1));
    }, 350);
    return () => {
      clearInterval(id);
      setLockedWidth(undefined);
      setDotCount(3);
    };
  }, [loading]);

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  const inert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      disabled={inert}
      onLayout={onLayout}
      onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        disabled && disabledStyles[variant],
        lockedWidth !== undefined && { width: lockedWidth },
        pressed && !inert && { transform: [{ scale: motion.pressScale }] },
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          {/* Always 3 mono dot glyphs — hidden ones go transparent, so the
              text run is constant-width even if onLayout never fired. */}
          <Text style={[styles.label, labelStyles[variant], styles.monoDots]}>
            {'.'.repeat(dotCount)}
            <Text style={styles.dotHidden}>{'.'.repeat(3 - dotCount)}</Text>
          </Text>
        </View>
      ) : (
        <Text style={[styles.label, labelStyles[variant], disabled && styles.labelDisabled]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: space.target,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
  },
  labelDisabled: {
    color: colors.paper30,
  },
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoDots: {
    fontFamily: fonts.monoMedium,
  },
  dotHidden: {
    color: 'transparent',
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    height: space.buttonHeight,
    backgroundColor: colors.safelight,
    paddingHorizontal: 32,
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.paper,
    backgroundColor: 'transparent',
  },
  text: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
  },
});

const disabledStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.ink2,
  },
  ghost: {
    borderColor: colors.paper30,
  },
  text: {},
});

const labelStyles = StyleSheet.create({
  primary: {
    color: colors.ink,
  },
  ghost: {
    color: colors.paper,
  },
  text: {
    color: colors.paper60,
  },
});
