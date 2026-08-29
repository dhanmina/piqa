import { useRef, useState } from 'react';
import { Text, Pressable, TextInput } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { signInWithGoogle, signInWithEmail } from '../../lib/auth';
import { mapAuthError } from '../../lib/authErrors';
import { colors, spacing, touchTarget, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { AuthHero } from '../../components/AuthHero';
import { FilledField } from '../../components/FilledField';
import { FieldError } from '../../components/FieldError';
import { Button } from '../../components/Button';
import { Divider } from '../../components/Divider';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = email.length > 0 && password.length > 0 && !loading;
  const passwordRef = useRef<TextInput>(null);

  async function handleEmailSignIn() {
    setError(null);
    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) setError(mapAuthError(error).message);
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) setError(mapAuthError(error).message);
  }

  return (
    <Screen>
      <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
        <AuthHero tagline="Capture daily. Keep your streak. Peek into your past." />

        <Button
          label="Continue with Google"
          loadingLabel="Opening Google…"
          variant="secondary"
          onPress={handleGoogleSignIn}
          disabled={loading}
          loading={loading}
        />

        <Divider label="or" />

        <FilledField
          placeholder="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <FilledField
          ref={passwordRef}
          placeholder="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          secureTextEntry
          revealable
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={handleEmailSignIn}
        />

        <FieldError message={error} />

        <Button label="Sign in" loadingLabel="Signing in…" onPress={handleEmailSignIn} disabled={!canSubmit} loading={loading} />

        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
        >
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Don't have an account? <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Sign up</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}
