import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { getSession } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    getSession()
      .then((session) => {
        setSignedIn(!!session);
        setChecked(true);
      })
      .catch(() => setChecked(true));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
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
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="recap" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
