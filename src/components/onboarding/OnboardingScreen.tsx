import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/components/tokens';

type OnboardingScreenProps = {
  /** The centered vertical stack — the screen's message. */
  children: ReactNode;
  /** Pinned into the thumb zone. The primary CTA (and any secondary link) live here,
   *  so the whitespace gap always falls between the message and the action. */
  cta: ReactNode;
};

/**
 * The shell every onboarding step shares: a full-bleed ink screen with the message
 * optically centered and the action pinned low. Full screen, one background, no
 * chrome — the step-to-step slide is owned by the parent (onboarding.tsx), not here.
 */
export function OnboardingScreen({ children, cta }: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.content}>{children}</View>
      <View style={styles.cta}>{cta}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
  },
  cta: {
    paddingHorizontal: space.gutter,
    paddingBottom: space.gutter,
    gap: 4,
  },
});
