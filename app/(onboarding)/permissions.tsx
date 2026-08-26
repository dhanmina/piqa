import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { markOnboardingComplete } from '../../lib/onboarding';
import { colors, spacing, radius, type } from '../../lib/theme';

export default function Permissions() {
  async function requestAndContinue() {
    await Camera.requestCameraPermissionsAsync();
    await Notifications.requestPermissionsAsync();
    await markOnboardingComplete();
    router.push('/capture?firstCapture=true');
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.background }}>
      <Text style={{ ...type.body, textAlign: 'center', color: colors.textPrimary }}>
        We'll need your camera to capture, and a gentle daily reminder to help the habit stick.
      </Text>
      <Pressable
        onPress={requestAndContinue}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          paddingVertical: spacing.md - 2,
          paddingHorizontal: spacing.lg + 4,
          borderRadius: radius.button,
        })}
      >
        <Text style={{ ...type.bodyBold, color: colors.background }}>Continue</Text>
      </Pressable>
    </View>
  );
}
