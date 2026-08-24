import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="recap" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
