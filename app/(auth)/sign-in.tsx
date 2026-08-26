import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { signInWithGoogle, signInWithEmail } from '../../lib/auth';
import { mapAuthError } from '../../lib/authErrors';
import { colors, spacing, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
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

  async function handleEmailSignIn() {
    setError(null);
    setLoading(true);
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) setError(mapAuthError(error).message);
  }

  return (
    <Screen style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
        <Text style={{ fontSize: 40, fontWeight: '700', color: colors.textPrimary, letterSpacing: -1, textAlign: 'center' }}>piqa</Text>
        <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm }}>
          Capture daily. Keep your streak. Peek into your past.
        </Text>

        <FilledField
          placeholder="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          keyboardType="email-address"
        />
        <FilledField
          placeholder="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          secureTextEntry
        />

        <FieldError message={error} />

        <Button label="Sign in" loadingLabel="Signing in…" onPress={handleEmailSignIn} disabled={!canSubmit} loading={loading} />

        <Pressable onPress={() => router.push('/(auth)/sign-up')} style={{ paddingVertical: spacing.sm }}>
          <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
            Don't have an account? <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Sign up</Text>
          </Text>
        </Pressable>
      </View>

      <View>
        <Divider />
        <Button label="Sign in with Google" variant="secondary" onPress={signInWithGoogle} />
      </View>
    </Screen>
  );
}
