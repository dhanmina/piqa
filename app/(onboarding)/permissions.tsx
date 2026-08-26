import { Text } from 'react-native';
import { router } from 'expo-router';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { markOnboardingComplete } from '../../lib/onboarding';
import { colors, spacing, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';

export default function Permissions() {
  async function requestAndContinue() {
    await Camera.requestCameraPermissionsAsync();
    await Notifications.requestPermissionsAsync();
    await markOnboardingComplete();
    router.push('/capture?firstCapture=true');
  }
  return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
      <Text style={{ ...type.body, textAlign: 'center', color: colors.textPrimary }}>
        We'll need your camera to capture, and a gentle daily reminder to help the habit stick.
      </Text>
      <Button label="Continue" onPress={requestAndContinue} />
    </Screen>
  );
}
