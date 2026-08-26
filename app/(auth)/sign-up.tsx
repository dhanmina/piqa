import { useState } from 'react';
import { Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { signUpWithEmail } from '../../lib/auth';
import { colors, spacing, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { FilledField } from '../../components/FilledField';
import { Button } from '../../components/Button';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = email.length > 0 && password.length > 0 && confirmPassword.length > 0 && !loading;

  async function handleSignUp() {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const { error } = await signUpWithEmail(email, password);
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <Screen style={{ justifyContent: 'center', gap: spacing.md }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm }}>
        Create your account
      </Text>

      <FilledField placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <FilledField placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <FilledField placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

      {error && <Text style={{ ...type.caption, color: colors.textPrimary, textAlign: 'center' }}>{error}</Text>}

      <Button label="Sign up" loadingLabel="Creating account…" onPress={handleSignUp} disabled={!canSubmit} loading={loading} />

      <Pressable onPress={() => router.back()} style={{ paddingVertical: spacing.sm }}>
        <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
          Already have an account? <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Sign in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}
