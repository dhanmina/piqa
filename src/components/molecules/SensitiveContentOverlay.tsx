/**
 * SensitiveContentOverlay — covers a photo with a dark overlay + label when
 * content is flagged by the moderation scan. Tap to reveal (one tap, no
 * confirmation — the toggle in Settings is the deliberate control).
 *
 * Follows the Darkroom laws: no new colors, no gradients, no sound.
 */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Mono } from '@/components/atoms/Mono';
import { colors, fonts, radius, typeScale } from '@/components/tokens';

type Props = {
  /** Whether this photo is flagged (content_label is not 'safe' and not null). */
  flagged: boolean;
  /** The blur_sensitive user preference. When false, never overlay. */
  blurEnabled: boolean;
  children: React.ReactNode;
};

export function SensitiveContentOverlay({ flagged, blurEnabled, children }: Props) {
  const [revealed, setRevealed] = useState(false);
  const showBlur = flagged && blurEnabled && !revealed;

  return (
    <View style={styles.container}>
      {children}
      {showBlur && (
        <Pressable
          style={styles.overlay}
          onPress={() => {
            void Haptics.selectionAsync();
            setRevealed(true);
          }}
          accessibilityLabel="Reveal sensitive content"
        >
          <View style={styles.labelContainer}>
            <View style={styles.badge}>
              <Mono size={typeScale.caption} weight="medium" color={colors.paper}>
                SENSITIVE
              </Mono>
            </View>
            <Text style={styles.hint}>Tap to reveal</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 11, 10, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  labelContainer: {
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: colors.ink2,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paper30,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
  },
});
