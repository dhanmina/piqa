/**
 * First-launch onboarding (spec: five screens, screen 5 dropped) — four sequential
 * steps shown once, before auth: Hook, the loop, then the two reasoned permission
 * asks. One route with an internal step index, not four routes: that makes "strictly
 * sequential, no back, no pagination" structural (there is no stack to pop) and lets
 * the step-to-step motion be exactly one horizontal slide, 250ms, ease-out.
 *
 * Permissions follow reason-before-dialog: the OS sheet only ever fires on the
 * primary CTA, never on mount, and denial never blocks — every path advances.
 */
import { useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Aperture, Bell, Camera, Crown, Timer, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

import { setOnboardingComplete } from '@lib/utils/onboarding';
import { Brandmark } from '@/components/atoms/Brandmark';
import { Button } from '@/components/atoms/Button';
import { displayFamily } from '@/components/fonts';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { PermissionBlock } from '@/components/onboarding/PermissionBlock';
import { SecondaryLink } from '@/components/onboarding/SecondaryLink';
import { colors, fonts, typeScale } from '@/components/tokens';

const LAST_STEP = 3;

/** One row of the loop: an icon and a single line, left-aligned within the group. */
function LoopRow({ icon: Icon, tint, text }: { icon: LucideIcon; tint: string; text: string }) {
  return (
    <View style={styles.loopRow}>
      <Icon size={26} strokeWidth={2.25} color={tint} />
      <Text style={styles.loopText}>{text}</Text>
    </View>
  );
}

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [, requestCamera] = useCameraPermissions();

  // No back, anywhere: swallow the Android hardware back the whole time onboarding
  // is up, so it can never jump a step or fall out to a blank stack.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const finish = async () => {
    await setOnboardingComplete();
    router.replace('/auth'); // onboarding sits before auth; identity is collected there
  };

  const advance = () => {
    if (step < LAST_STEP) setStep(step + 1);
    else void finish();
  };

  // Reason-before-dialog: fire the OS sheet on tap, then advance no matter the outcome
  // (ungranted state is handled later, at capture / send time).
  const allowCamera = async () => {
    try {
      await requestCamera();
    } catch {
      // ignore — denial and errors both just move on
    }
    advance();
  };

  const allowNotifications = async () => {
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // ignore — denial and errors both just move on
    }
    advance();
  };

  let content: React.ReactNode;
  let cta: React.ReactNode;

  if (step === 0) {
    // 1 — Hook
    content = (
      <View style={styles.hookStack}>
        {/* The mark is already the viewfinder motif (three bracket corners + the
            shutter dot), so it stands alone — wrapping it in more brackets doubled
            the same language. */}
        <Brandmark size={96} />
        <View style={styles.headlineGroup}>
          <Text style={styles.hookHeadline}>One shot. Every day.</Text>
          <Text style={styles.subhead}>A daily photo challenge. Nothing to doomscroll.</Text>
        </View>
      </View>
    );
    cta = <Button label="Start" fullWidth onPress={advance} />;
  } else if (step === 1) {
    // 2 — The loop. Crown gold appears here and nowhere else in onboarding.
    content = (
      <View style={styles.loopStack}>
        <LoopRow icon={Aperture} tint={colors.safelight} text="Today's Shot drops each evening." />
        <LoopRow icon={Timer} tint={colors.safelight} text="You have until midnight to shoot." />
        <LoopRow icon={Crown} tint={colors.crown} text="Vote blind. One photo wins by morning." />
      </View>
    );
    cta = <Button label="Got it" fullWidth onPress={advance} />;
  } else if (step === 2) {
    // 3 — Camera permission (reason before dialog)
    content = (
      <PermissionBlock
        icon={Camera}
        title="Shot in the app. Always."
        subtitle="Every photo is a live, unedited capture. No old shots, no filters."
      />
    );
    cta = (
      <>
        <Button label="Allow camera" fullWidth onPress={() => void allowCamera()} />
        <SecondaryLink label="Not now" onPress={advance} />
      </>
    );
  } else {
    // 4 — Notification permission (reason before dialog)
    content = (
      <PermissionBlock
        icon={Bell}
        title="Never miss Today's Shot."
        subtitle="A nudge when it drops each evening, and when results land in the morning."
      />
    );
    cta = (
      <>
        <Button label="Turn on" fullWidth onPress={() => void allowNotifications()} />
        <SecondaryLink label="Not now" onPress={advance} />
      </>
    );
  }

  return (
    <View style={styles.root}>
      {/* One coordinated horizontal slide, 250ms ease-out: the leaving step exits
          left as the next enters from the right. The first step doesn't enter-slide
          (the route fades it in), but it still exits left when it hands off. */}
      <Animated.View
        key={step}
        style={StyleSheet.absoluteFill}
        entering={step === 0 ? undefined : SlideInRight.duration(250).easing(Easing.out(Easing.ease))}
        exiting={SlideOutLeft.duration(250).easing(Easing.out(Easing.ease))}
      >
        <OnboardingScreen cta={cta}>{content}</OnboardingScreen>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  hookStack: { alignItems: 'center', gap: 32 },
  headlineGroup: { alignItems: 'center', gap: 10 },
  hookHeadline: {
    fontFamily: displayFamily,
    fontSize: typeScale.display,
    color: colors.paper,
    textAlign: 'center',
  },
  subhead: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    lineHeight: typeScale.sub * 1.4,
    color: colors.paper60,
    textAlign: 'center',
  },
  loopStack: { gap: 28 },
  loopRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  loopText: {
    fontFamily: fonts.sans,
    fontSize: typeScale.body,
    color: colors.paper,
    flexShrink: 1,
  },
});
