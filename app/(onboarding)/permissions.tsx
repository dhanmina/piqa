import { useState } from 'react';
import { Text, View, Pressable, Linking } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { markOnboardingComplete } from '../../lib/onboarding';
import { useAuthState } from '../../lib/authState';
import { colors, spacing, touchTarget, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { OnboardingProgress } from '../../components/OnboardingProgress';

const BACK_ICON = { ios: 'chevron.left', android: 'arrow_back' } as const;

export default function Permissions() {
  const [requesting, setRequesting] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const { markOnboarded } = useAuthState();

  async function finish() {
    await markOnboardingComplete();
    // RootLayout's `onboarded` guard drives whether `(tabs)` is even a mounted route —
    // it only otherwise refreshes on an auth event, which this DB write doesn't trigger.
    // Without this, confirm() in capture.tsx later replaces to a route the Stack doesn't
    // consider active yet, and silently no-ops (stuck on the capture screen).
    markOnboarded();
    router.push('/capture?firstCapture=true');
  }

  async function requestAndContinue() {
    setRequesting(true);
    const camera = await Camera.requestCameraPermissionsAsync();
    const notif = await Notifications.requestPermissionsAsync();
    setRequesting(false);
    const cameraOk = camera.status === 'granted';
    const notifOk = notif.status === 'granted';
    setCameraDenied(!cameraOk);
    setNotifDenied(!notifOk);
    if (cameraOk && notifOk) await finish();
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          hitSlop={touchTarget.min}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <SymbolView name={BACK_ICON} size={22} tintColor={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <OnboardingProgress step={3} total={3} />
        </View>
      </View>
      <Animated.View
        entering={FadeInUp.duration(220)}
        style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...type.screenTitle, color: colors.textPrimary, textAlign: 'center' }}>
            Just two things
          </Text>
          <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
            So piqa can actually do its job.
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...type.bodyBold, color: colors.textPrimary }}>Your camera</Text>
            <Text style={{ ...type.body, color: colors.textMuted }}>So you can capture the moment it happens. That's really the whole app.</Text>
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text style={{ ...type.bodyBold, color: colors.textPrimary }}>A daily nudge</Text>
            <Text style={{ ...type.body, color: colors.textMuted }}>One reminder, so the habit doesn't slip. Off anytime you want.</Text>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          {cameraDenied && (
            <Animated.View entering={FadeIn.duration(250)} style={{ gap: spacing.sm, marginBottom: spacing.xs }}>
              <FieldError message="Camera's off, so capture won't work yet. Turn it on in Settings, or keep going and flip it on whenever." />
              <Button label="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
            </Animated.View>
          )}
          {!cameraDenied && notifDenied && (
            <Animated.View entering={FadeIn.duration(250)} style={{ marginBottom: spacing.xs }}>
              <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
                No daily nudge for now. Turn it on later in Settings whenever you want one.
              </Text>
            </Animated.View>
          )}
          <Button
            label={cameraDenied ? 'Continue without camera' : 'Continue'}
            loadingLabel="Setting up…"
            onPress={cameraDenied || notifDenied ? finish : requestAndContinue}
            loading={requesting}
            disabled={requesting}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}
