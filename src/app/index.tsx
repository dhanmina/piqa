import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { getOnboardingComplete } from '@lib/utils/onboarding';
import { useSession } from '@lib/session';

export default function Index() {
  const { session, loading } = useSession();
  // First-launch onboarding is device-local and only matters while signed out, so
  // read it once here. null = still reading; render nothing until we know, so the
  // first paint lands on the right screen instead of flashing auth then onboarding.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    void getOnboardingComplete().then(setOnboarded);
  }, []);

  if (loading) return null;
  if (session) return <Redirect href={'/reveal' as any} />;
  if (onboarded === null) return null; // signed out — wait for the flag before routing
  return <Redirect href={onboarded ? '/auth' : '/onboarding'} />;
}
