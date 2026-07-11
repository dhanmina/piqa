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
        <Stack.Screen name="curate" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="photo/[id]" options={{ presentation: 'modal' }} />
        {__DEV__ && <Stack.Screen name="dev/time-machine" />}
        {__DEV__ && <Stack.Screen name="dev/kit" />}
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
    if (!fontsLoaded && !fontError) return;

    if (fontError) {
      console.warn('[fonts] bundled fonts failed to load:', fontError);
    } else if (__DEV__ && !Font.isLoaded(fonts.display)) {
      console.log(`[fonts] ${fonts.display} not bundled — display text falls back to ${fonts.displayFallback}`);
    }

    SplashScreen.hideAsync();
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
