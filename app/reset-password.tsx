import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { completePasswordReset } from '../lib/auth';
import { changePassword } from '../lib/settings';
import { mapAuthError } from '../lib/authErrors';
import { colors, spacing, type } from '../lib/theme';
import { Screen } from '../components/Screen';
import { FilledField } from '../components/FilledField';
import { FieldError } from '../components/FieldError';
import { Button } from '../components/Button';

// Reached only via the recovery email's deep link (piqa://reset-password#access_token=...) --
// never linked to from inside the app. Not gated behind signedIn in app/_layout.tsx: the
// session doesn't exist yet on cold boot, it's established below from the link's own tokens,
// so gating this route on signedIn would race the guard against this screen's own async setup.
export default function ResetPassword() {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    async function establish(url: string | null) {
      if (!url || handledRef.current) return;
      handledRef.current = true;
      const { error } = await completePasswordReset(url);
      if (error) {
        setLinkError('This reset link is invalid or has expired. Request a new one from the sign-in screen.');
        return;
      }
      setReady(true);
    }
    Linking.getInitialURL().then(establish);
    const sub = Linking.addEventListener('url', ({ url }) => establish(url));
    return () => sub.remove();
  }, []);

  const canSave = ready && password.length > 0 && confirm.length > 0 && !saving;

  async function handleSave() {
    setFormError(null);
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error } = await changePassword(password);
    setSaving(false);
    if (error) {
      setFormError(mapAuthError(error).message);
      return;
    }
    setSaved(true);
  }

  if (saved) {
    return (
      <Screen style={{ gap: spacing.md, justifyContent: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary, textAlign: 'center' }}>Password updated</Text>
        <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
          Use your new password next time you sign in.
        </Text>
        <Button label="Continue" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  if (linkError) {
    return (
      <Screen style={{ gap: spacing.md, justifyContent: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary, textAlign: 'center' }}>Link expired</Text>
        <FieldError message={linkError} />
        <Button label="Back to sign in" variant="secondary" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  if (!ready) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textMuted} />
      </Screen>
    );
  }

  return (
    <Screen style={{ gap: spacing.md, justifyContent: 'center' }}>
      <Text style={{ ...type.title, color: colors.textPrimary, textAlign: 'center' }}>Set a new password</Text>
      <FilledField
        placeholder="New password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setFormError(null);
        }}
        secureTextEntry
        revealable
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="next"
        error={!!formError}
      />
      <FilledField
        placeholder="Confirm new password"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setFormError(null);
        }}
        secureTextEntry
        revealable
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="done"
        onSubmitEditing={handleSave}
        error={!!formError}
      />
      <FieldError message={formError} />
      <Button label="Save" loadingLabel="Saving…" onPress={handleSave} disabled={!canSave} loading={saving} />
    </Screen>
  );
}
