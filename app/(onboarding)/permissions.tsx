import { useState } from 'react';
import { Text, View, Linking } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { markOnboardingComplete } from '../../lib/onboarding';
import { colors, spacing, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { OnboardingProgress } from '../../components/OnboardingProgress';

export default function Permissions() {
  const [requesting, setRequesting] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);

  async function finish() {
    await markOnboardingComplete();
    router.push('/capture?firstCapture=true');
  }

  async function requestAndContinue() {
    setRequesting(true);
    const camera = await Camera.requestCameraPermissionsAsync();
    await Notifications.requestPermissionsAsync();
    setRequesting(false);
    if (camera.status !== 'granted') {
      setCameraDenied(true);
      return;
    }
    await finish();
  }

  return (
    <Screen>
      <OnboardingProgress step={2} total={2} />
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
          <Button
            label={cameraDenied ? 'Continue without camera' : 'Continue'}
            loadingLabel="Setting up…"
            onPress={cameraDenied ? finish : requestAndContinue}
            loading={requesting}
            disabled={requesting}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}
