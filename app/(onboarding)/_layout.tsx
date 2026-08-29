import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="username" />
      <Stack.Screen name="intent" />
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
