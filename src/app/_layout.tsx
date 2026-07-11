import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { initCaptureQueue } from '@lib/captureQueue';
import { SessionProvider, useSession } from '@lib/session';
import { useAppFonts } from '@/components/fonts';
import { colors, fonts } from '@/components/tokens';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useSession();

  if (loading) return null; // splash stays up until the stored session is read

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
      }}
    >
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="camera"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="vote" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    // The queue must come alive with the app — it resumes interrupted uploads.
    void initCaptureQueue();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (__DEV__) {
        console.log(
          '[fonts] useFonts loaded:', fontsLoaded,
          '| error:', fontError ?? null,
          '| ClashDisplay-Semibold registered:', Font.isLoaded(fonts.display),
        );
      }
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SessionProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SessionProvider>
  );
}
