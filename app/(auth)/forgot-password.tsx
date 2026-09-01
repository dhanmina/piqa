import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { requestPasswordReset, verifyPasswordResetCode } from '../../lib/auth';
import { changePassword } from '../../lib/settings';
import { mapAuthError } from '../../lib/authErrors';
import { colors, spacing, touchTarget, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { FilledField } from '../../components/FilledField';
import { FieldError } from '../../components/FieldError';
import { Button } from '../../components/Button';
import { TextLink } from '../../components/TextLink';
import { BackIcon } from '../../components/Icons';

type Step = 'email' | 'code';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSendCode() {
    setError(null);
    setLoading(true);
    // resetPasswordForEmail always resolves without revealing whether the address
    // is registered -- same enumeration-safe convention as the rest of this app's
    // auth errors (see mapAuthError's invalid_credentials case).
    const { error } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (error) {
      setError(mapAuthError(error).message);
      return;
    }
    setStep('code');
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setLoading(true);
    const { error } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (error) {
      setError(mapAuthError(error).message);
      return;
    }
    setResent(true);
  }

  async function handleReset() {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: verifyError } = await verifyPasswordResetCode(email.trim(), code.trim());
    if (verifyError) {
      setLoading(false);
      setError(mapAuthError(verifyError).message);
      return;
    }
    const { error: saveError } = await changePassword(password);
    setLoading(false);
    if (saveError) {
      setError(mapAuthError(saveError).message);
      return;
    }
    setDone(true);
  }

  const canSendCode = email.trim().length > 0 && !loading;
  const canReset = code.trim().length > 0 && password.length > 0 && confirm.length > 0 && !loading;

  return (
    <Screen style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          hitSlop={touchTarget.min}
          onPress={() => (step === 'code' ? setStep('email') : router.back())}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <BackIcon size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Reset password</Text>
      </View>

      {done ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <Text style={{ ...type.body, color: colors.textPrimary, textAlign: 'center' }}>
            Password updated. Use it next time you sign in.
          </Text>
          <Button label="Continue" onPress={() => router.dismissTo('/')} />
        </View>
      ) : step === 'email' ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
            Enter your email and we'll send you a code to reset your password.
          </Text>
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
            returnKeyType="done"
            onSubmitEditing={handleSendCode}
            error={!!error}
          />
          <FieldError message={error} />
          <Button
            label="Send code"
            loadingLabel="Sending…"
            onPress={handleSendCode}
            disabled={!canSendCode}
            loading={loading}
          />
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
            Enter the code we sent to {email.trim()}, and your new password.
          </Text>
          <FilledField
            placeholder="6-digit code"
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setError(null);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="next"
          />
          <FilledField
            placeholder="New password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(null);
            }}
            secureTextEntry
            revealable
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="next"
            error={!!error}
          />
          <FilledField
            placeholder="Confirm new password"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              setError(null);
            }}
            secureTextEntry
            revealable
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleReset}
            error={!!error}
          />
          <FieldError message={error ?? (resent ? 'Sent a new code.' : null)} />
          <Button label="Reset password" loadingLabel="Resetting…" onPress={handleReset} disabled={!canReset} loading={loading} />
          <TextLink label="Resend code" onPress={handleResend} disabled={loading} />
        </View>
      )}
    </Screen>
  );
}
