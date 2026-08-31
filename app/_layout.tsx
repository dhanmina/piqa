import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { getSession } from '../lib/auth';
import { getOnboardingStatus, getNeedsUsername } from '../lib/onboarding';
import { supabase } from '../lib/supabase';
import { AuthStateProvider } from '../lib/authState';

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
    <AuthStateProvider
      value={{
        signedIn,
        onboarded,
        needsUsername,
        markOnboarded: () => setOnboarded(true),
        markUsernameSet: () => setNeedsUsername(false),
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
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
    </AuthStateProvider>
  );
}
