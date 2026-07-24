import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { useAppUpdate } from '@lib/appUpdate';
import { initCaptureQueue } from '@lib/services/captureQueue';
import { FrameCatalogProvider } from '@lib/hooks/frames';
import { wrapRoot } from '@lib/services/sentry';
import { prefetchEssentials } from '@lib/services/prefetch';
import { registerForPush, useNotificationRouting } from '@lib/push';
import { SessionProvider, useSession } from '@lib/session';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdatePrompt } from '@/components/molecules/UpdatePrompt';
import { useAppFonts } from '@/components/fonts';
import { colors, fonts } from '@/components/tokens';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useSession();

  // Play Store update nudge — soft (dismissible) unless the installed build is
  // below the config's min_build. Gated on a session (config reads are RLS'd).
  const { status: updateStatus, openStore } = useAppUpdate(session !== null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

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
    <>
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
        // Snappier transitions: the 350ms default read as slow/laggy. iOS-only
        // (Android stack durations are fixed by the OS) and only applies to
        // fade / slide_from_bottom / simple_push — which is exactly why the
        // drill-in screens below use simple_push, not slide_from_right.
        animationDuration: 220,
      }}
    >
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="auth" />
        {/* First-launch intro, shown before auth. Fades in (its 4 steps own the
            horizontal slide internally); the gesture is off so there's no back. */}
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="camera"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen name="curate" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="photo/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="search" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="u/[id]" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="following" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="blocked" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="activity" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="settings" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="admin" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="admin-library" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="edit-profile" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="legal/terms" options={{ animation: 'simple_push' }} />
        <Stack.Screen name="legal/privacy" options={{ animation: 'simple_push' }} />
        {__DEV__ && <Stack.Screen name="dev/time-machine" />}
        {__DEV__ && <Stack.Screen name="dev/kit" />}
      </Stack.Protected>
    </Stack>
    <UpdatePrompt
      visible={updateStatus !== 'none' && !(updateStatus === 'soft' && updateDismissed)}
      forced={updateStatus === 'forced'}
      onUpdate={openStore}
      onDismiss={() => setUpdateDismissed(true)}
    />
    </>
  );
}

function RootLayout() {
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
    // Required by react-native-safe-area-context v5: without it SafeAreaView and
    // useSafeAreaInsets() report 0 insets, so pushed-screen headers (search,
    // others' profile, following, settings) rendered under the notch and their
    // back button was hidden on real devices. expo-router no longer injects one.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SessionProvider>
        <FrameCatalogProvider>
          <ErrorBoundary>
            <StatusBar style="light" />
            <RootNavigator />
          </ErrorBoundary>
        </FrameCatalogProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap the root so render/runtime errors are captured (no-op without a DSN).
export default wrapRoot(RootLayout);
