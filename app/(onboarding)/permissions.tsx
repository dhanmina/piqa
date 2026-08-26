import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { markOnboardingComplete } from '../../lib/onboarding';

export default function Permissions() {
  async function requestAndContinue() {
    await Camera.requestCameraPermissionsAsync();
    await Notifications.requestPermissionsAsync();
    await markOnboardingComplete();
    router.push('/capture?firstCapture=true');
  }
  return (
    <View>
      <Text>We'll need your camera to capture, and a gentle daily reminder to help the habit stick.</Text>
      <Pressable onPress={requestAndContinue}><Text>Continue</Text></Pressable>
    </View>
  );
}
