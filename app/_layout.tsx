import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { getSession } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    getSession().then((session) => {
      setSignedIn(!!session);
      setChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!checked) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!signedIn && !inAuthGroup) router.replace('/(auth)/sign-in');
    if (signedIn && inAuthGroup) router.replace('/(tabs)/today');
  }, [checked, signedIn, segments]);

  if (!checked) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="recap" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
