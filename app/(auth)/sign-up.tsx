import { useRef, useState } from 'react';
import { Text, Pressable, TextInput } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { signInWithGoogle, signUpWithEmail } from '../../lib/auth';
import { mapAuthError } from '../../lib/authErrors';
import { colors, spacing, touchTarget, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { AuthHero } from '../../components/AuthHero';
import { FilledField } from '../../components/FilledField';
import { FieldError } from '../../components/FieldError';
import { Button } from '../../components/Button';
import { Divider } from '../../components/Divider';

type FieldErrors = { email?: string; password?: string };

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const canSubmit = email.length > 0 && password.length > 0 && !loading;
  const passwordRef = useRef<TextInput>(null);

  async function handleSignUp() {
    setFormError(null);
    setFieldErrors({});
    setLoading(true);
    const { error } = await signUpWithEmail(email, password);
    setLoading(false);
    if (error) {
      const mapped = mapAuthError(error);
      if (mapped.field) {
        setFieldErrors({ [mapped.field]: mapped.message });
      } else {
        setFormError(mapped.message);
      }
    }
  }

  async function handleGoogleSignUp() {
    setFormError(null);
    setFieldErrors({});
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) setFormError(mapAuthError(error).message);
  }

  return (
    <Screen>
      <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
        <AuthHero tagline="Create your account to start your streak." />

        <Button
          label="Sign up with Google"
          loadingLabel="Opening Google…"
          variant="secondary"
          onPress={handleGoogleSignUp}
          disabled={loading}
          loading={loading}
        />

        <Divider label="or" />

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
        {fieldErrors.email && (
          <Pressable
            onPress={() => router.replace('/(auth)/sign-in')}
            style={{ marginTop: -spacing.sm, minHeight: touchTarget.min, justifyContent: 'center' }}
          >
            <Text style={{ ...type.caption, color: colors.textPrimary, fontWeight: '600', textAlign: 'center' }}>
              Sign in instead
            </Text>
          </Pressable>
        )}

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
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={handleSignUp}
          error={!!fieldErrors.password}
        />
        <FieldError message={fieldErrors.password ?? null} />

        <FieldError message={formError} />

        <Button label="Sign up" loadingLabel="Creating account…" onPress={handleSignUp} disabled={!canSubmit} loading={loading} />

        <Pressable
          onPress={() => router.replace('/(auth)/sign-in')}
          style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
        >
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Already have an account? <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Sign in</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}
