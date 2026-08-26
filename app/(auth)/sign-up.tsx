import { useState } from 'react';
import { Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { signUpWithEmail } from '../../lib/auth';
import { mapAuthError } from '../../lib/authErrors';
import { colors, spacing, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { FilledField } from '../../components/FilledField';
import { FieldError } from '../../components/FieldError';
import { Button } from '../../components/Button';

type FieldErrors = { email?: string; password?: string; confirmPassword?: string };

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const canSubmit = email.length > 0 && password.length > 0 && confirmPassword.length > 0 && !loading;

  async function handleSignUp() {
    setFormError(null);
    setFieldErrors({});
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }
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

  return (
    <Screen style={{ justifyContent: 'center', gap: spacing.md }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm }}>
        Create your account
      </Text>

      <FilledField
        placeholder="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setFieldErrors((f) => ({ ...f, email: undefined }));
          setFormError(null);
        }}
        keyboardType="email-address"
        error={!!fieldErrors.email}
      />
      <FieldError message={fieldErrors.email ?? null} />
      {fieldErrors.email && (
        <Pressable onPress={() => router.back()} style={{ marginTop: -spacing.sm }}>
          <Text style={{ ...type.caption, color: colors.textPrimary, fontWeight: '600', textAlign: 'center' }}>
            Sign in instead
          </Text>
        </Pressable>
      )}

      <FilledField
        placeholder="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setFieldErrors((f) => ({ ...f, password: undefined, confirmPassword: undefined }));
          setFormError(null);
        }}
        secureTextEntry
        error={!!fieldErrors.password}
      />
      <FieldError message={fieldErrors.password ?? null} />

      <FilledField
        placeholder="Confirm password"
        value={confirmPassword}
        onChangeText={(v) => {
          setConfirmPassword(v);
          setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
          setFormError(null);
        }}
        secureTextEntry
        error={!!fieldErrors.confirmPassword}
      />
      <FieldError message={fieldErrors.confirmPassword ?? null} />

      <FieldError message={formError} />

      <Button label="Sign up" loadingLabel="Creating account…" onPress={handleSignUp} disabled={!canSubmit} loading={loading} />

      <Pressable onPress={() => router.back()} style={{ paddingVertical: spacing.sm }}>
        <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
          Already have an account? <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Sign in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}
