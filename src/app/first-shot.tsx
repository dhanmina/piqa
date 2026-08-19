/**
 * First-shot aha — the post-signup "aha" moment. A single screen that
 * welcomes the new user and invites them to take their first practice shot.
 * After capture, the camera shows the framed print with a mini reveal
 * animation, then routes into the main app.
 *
 * Shown once per device (gated by `firstShotComplete` flag). Device-local.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { setFirstShotComplete } from '@lib/utils/onboarding';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { Brandmark } from '@/components/atoms/Brandmark';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { displayFamily } from '@/components/fonts';
import { colors, fonts, space, typeScale } from '@/components/tokens';

export default function FirstShotScreen() {
  const router = useRouter();

  const start = async () => {
    await setFirstShotComplete();
    router.replace('/camera?practice=1&firstShot=1' as any);
  };

  const skip = async () => {
    await setFirstShotComplete();
    router.replace('/(tabs)/today');
  };

  return (
    <OnboardingScreen
      cta={
        <View style={styles.cta}>
          <Button label="Take your first shot" onPress={() => void start()} fullWidth />
          <Button label="Skip for now" variant="ghost" onPress={() => void skip()} fullWidth />
        </View>
      }
    >
      <View style={styles.center}>
        <Brandmark size={48} stroke={colors.paper} />
        <Mono size={typeScale.caption} weight="medium" color={colors.crown} style={styles.eyebrow}>
          YOUR FIRST PRINT
        </Mono>
        <Text style={styles.headline}>Every photo becomes a framed print.</Text>
        <Text style={styles.sub}>
          Take one shot. Watch it develop. That&apos;s the magic.
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: 16,
  },
  eyebrow: {
    letterSpacing: 1.5,
    marginTop: 24,
  },
  headline: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    lineHeight: typeScale.title * 1.15,
    color: colors.paper,
    textAlign: 'center',
    paddingHorizontal: space.gutter,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: typeScale.body,
    color: colors.paper60,
    textAlign: 'center',
    paddingHorizontal: space.gutter,
  },
  cta: {
    gap: 8,
  },
});
