import { Redirect } from 'expo-router';
import { useAuthState } from '../lib/authState';

export default function Index() {
  const { signedIn, onboarded } = useAuthState();

  if (!signedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!onboarded) return <Redirect href="/(onboarding)/intent" />;
  return <Redirect href="/(tabs)/today" />;
}
