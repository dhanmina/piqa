import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { getFirstShotComplete, getOnboardingComplete } from '@lib/utils/onboarding';
import { useSession } from '@lib/session';

export default function Index() {
  const { session, loading } = useSession();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [firstShotDone, setFirstShotDone] = useState<boolean | null>(null);
  useEffect(() => {
    void getOnboardingComplete().then(setOnboarded);
    void getFirstShotComplete().then(setFirstShotDone);
  }, []);

  if (loading) return null;
  if (session) {
    if (firstShotDone === null) return null;
    if (!firstShotDone) return <Redirect href={'/first-shot' as any} />;
    return <Redirect href={'/reveal' as any} />;
  }
  if (onboarded === null) return null;
  return <Redirect href={onboarded ? '/auth' : '/onboarding'} />;
}
