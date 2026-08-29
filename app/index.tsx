import { Redirect } from 'expo-router';
import { useAuthState } from '../lib/authState';

export default function Index() {
  const { signedIn, onboarded, needsUsername } = useAuthState();

  if (!signedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!onboarded) return <Redirect href={needsUsername ? '/(onboarding)/username' : '/(onboarding)/intent'} />;
  return <Redirect href="/(tabs)/today" />;
}
