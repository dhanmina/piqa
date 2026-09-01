import { useRef, useState } from 'react';
import { Text, View, Pressable, TextInput } from 'react-native';
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
import { TextLink } from '../../components/TextLink';

type FieldErrors = { email?: string; password?: string };

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const canSubmit = email.length > 0 && password.length > 0 && !loading;
  const passwordRef = useRef<TextInput>(null);

  function clearErrors() {
    setFormError(null);
    setFieldErrors({});
  }

  async function handleEmailSignIn() {
    clearErrors();
    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) {
      const mapped = mapAuthError(error);
      if (mapped.field === 'email' || mapped.field === 'password') {
        setFieldErrors({ [mapped.field]: mapped.message });
      } else {
        setFormError(mapped.message);
      }
    }
  }

  async function handleGoogleSignIn() {
    clearErrors();
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) setFormError(mapAuthError(error).message);
  }

  return (
    <Screen>
      <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ marginBottom: spacing.xxl }}>
          <AuthHero tagline="Capture daily. Keep your streak. Peek into your past." />
        </View>

        <Button
          label="Continue with Google"
          loadingLabel="Opening Google…"
          variant="secondary"
          onPress={handleGoogleSignIn}
          disabled={loading}
          loading={loading}
        />

        <Divider label="or" />

        <View style={{ gap: spacing.sm }}>
          <View style={{ gap: spacing.xs }}>
            <FilledField
              placeholder="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setFieldErrors((f) => ({ ...f, email: undefined }));
                setFormError(null);
              }}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={!!fieldErrors.email}
            />
            <FieldError message={fieldErrors.email ?? null} />
          </View>

          <View style={{ gap: spacing.xs }}>
            <FilledField
              ref={passwordRef}
              placeholder="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setFieldErrors((f) => ({ ...f, password: undefined }));
                setFormError(null);
              }}
              secureTextEntry
              revealable
              error={!!fieldErrors.password}
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleEmailSignIn}
            />
            <FieldError message={fieldErrors.password ?? formError} />
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <TextLink label="Forgot password?" inline onPress={() => router.push('/(auth)/forgot-password')} />
        </View>

        <View style={{ marginTop: spacing.xs }}>
          <Button label="Sign in" loadingLabel="Signing in…" onPress={handleEmailSignIn} disabled={!canSubmit} loading={loading} />
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          hitSlop={spacing.sm}
          style={{ minHeight: touchTarget.min, justifyContent: 'center', marginTop: spacing.lg }}
        >
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Don't have an account? <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Sign up</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}
