import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { getSession } from '../lib/auth';
import { getOnboardingStatus } from '../lib/onboarding';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    async function resolve(session: Session | null) {
      const isSignedIn = !!session;
      const isOnboarded = isSignedIn ? await getOnboardingStatus() : false;
      setSignedIn(isSignedIn);
      setOnboarded(isOnboarded);
      setChecked(true);
    }

    getSession().then(resolve).catch(() => setChecked(true));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!checked) return null;

  // Stack.Protected conditionally includes/excludes whole groups, so there's
  // never an "unmatched route" moment at boot the way an effect-driven
  // router.replace() from bare `/` (no app/index.tsx) can hit.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="recap" options={{ presentation: 'modal' }} />
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}
