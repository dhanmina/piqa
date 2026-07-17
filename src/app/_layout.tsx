import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';

import { initCaptureQueue } from '@lib/captureQueue';
import { FrameCatalogProvider } from '@lib/frames';
import { prefetchEssentials } from '@lib/prefetch';
import { registerForPush, useNotificationRouting } from '@lib/push';
import { SessionProvider, useSession } from '@lib/session';
import { useAppFonts } from '@/components/fonts';
import { colors, fonts } from '@/components/tokens';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useSession();

  // Register for push once signed in (spec §14). Best-effort — the app works
  // fully without it, so a failure never blocks anything.
  useEffect(() => {
    if (session) void registerForPush();
  }, [session]);

  // Deep-link a tapped notification to the right screen.
  useNotificationRouting();

  // Warm the first screens once per login (keyed on user id, so token refreshes
  // don't re-fetch). Runs after the cache has hydrated, so it only fills gaps.
  const prefetchedFor = useRef<string | null>(null);
  useEffect(() => {
    const uid = session?.user.id ?? null;
    if (uid && uid !== prefetchedFor.current) {
      prefetchedFor.current = uid;
      void prefetchEssentials();
    } else if (!uid) {
      prefetchedFor.current = null;
    }
  }, [session]);

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
        <Stack.Screen name="u/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="following" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
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
      <FrameCatalogProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </FrameCatalogProvider>
    </SessionProvider>
  );
}
