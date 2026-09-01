import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme } from 'expo-router/react-navigation';
import type { Session } from '@supabase/supabase-js';
import { getSession } from '../lib/auth';
import { getOnboardingStatus, getNeedsUsername } from '../lib/onboarding';
import { supabase } from '../lib/supabase';
import { AuthStateProvider } from '../lib/authState';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister, QUERY_CACHE_BUSTER, QUERY_CACHE_MAX_AGE } from '../lib/queryClient';
import { queryKeys, fetchProfileCreatedAt } from '../lib/captureQueries';
import { colors } from '../lib/theme';

// React Navigation's screen Background paints its theme's `colors.background`
// behind every screen -- unset, that defaults to the light theme (near-white),
// which is what flashed on every Android tab switch (native Fragment
// detach/reattach exposes it for a frame). Router never supplied a theme, so
// it fell through to that light default regardless of the app's own dark UI.
const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.textPrimary, border: colors.border },
};

/**
 * DIRECTION CONTRACT — seed key 9a4f58ae
 * THESIS: the streak is one continuous ink trace on a recording roll, not a
 *   card feed or a dot grid. Refuses the gamified-badge/rounded-card default.
 * OWN-WORLD: near-black recording paper, one bright white trace as the sole
 *   living accent, faint gray calibration hairlines, monospace for every
 *   data readout (streak counts, dates, stats) against system sans for prose.
 * STORY: the streak reads as a line the visitor is extending; a miss is a
 *   real gap, a freeze is a dashed continuation; Peek Back is the recorder
 *   head sliding back the roll and re-lighting an old mark.
 * FIRST VIEWPOINT: date readout, monospace hero streak count, the 7-day
 *   trace with today's pen-head, Peek Back's instrument plate below.
 * FORM: assigned direction, index 5 of 7, mode operate. Lost to two named
 *   challengers on record: Emission-Line Rail, Darkroom Safelight Bay.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with
 *   DESIGN.md rewritten from the built world.
 */
export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    async function resolve(session: Session | null) {
      const isSignedIn = !!session;
      const isOnboarded = isSignedIn ? await getOnboardingStatus() : false;
      const needsUsernameNext = isSignedIn && !isOnboarded ? await getNeedsUsername() : false;
      setSignedIn(isSignedIn);
      setOnboarded(isOnboarded);
      setNeedsUsername(needsUsernameNext);
      setChecked(true);
      // Warm this before any tab mounts -- timeline.tsx needs it to classify pre-account
      // days correctly, and fetching it here (once, cached forever) means the tab never
      // has to show its own separate loading wait for it.
      if (isSignedIn) {
        queryClient.prefetchQuery({ queryKey: queryKeys.profileCreatedAt, queryFn: fetchProfileCreatedAt, staleTime: Infinity });
      }
    }

    getSession().then(resolve).catch(() => setChecked(true));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!checked) return null;

  // Stack.Protected only controls which groups are navigable once mounted —
  // it does NOT create a match for the bare `/` path a custom-scheme cold
  // boot (e.g. `piqa:///`) requests. That still needs a real app/index.tsx,
  // which redirects into whichever group below is actually active.
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: QUERY_CACHE_MAX_AGE, buster: QUERY_CACHE_BUSTER }}
    >
      <AuthStateProvider
        value={{
          signedIn,
          onboarded,
          needsUsername,
          markOnboarded: () => setOnboarded(true),
          markUsernameSet: () => setNeedsUsername(false),
        }}
      >
        <ThemeProvider value={navigationTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            {/* Reached only via the recovery email's deep link, before a session exists --
                deliberately outside every Stack.Protected block below (see reset-password.tsx's
                own top-of-file comment for why gating this on signedIn would race the guard). */}
            <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && !onboarded}>
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && onboarded}>
              <Stack.Screen name="(tabs)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="recap" options={{ presentation: 'modal' }} />
              <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add-buddy" options={{ presentation: 'modal' }} />
              <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </AuthStateProvider>
    </PersistQueryClientProvider>
  );
}
