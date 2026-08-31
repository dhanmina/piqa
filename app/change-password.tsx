import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { changePassword } from '../lib/settings';
import { mapAuthError } from '../lib/authErrors';
import { Screen } from '../components/Screen';
import { FilledField } from '../components/FilledField';
import { FieldError } from '../components/FieldError';
import { Button } from '../components/Button';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = password.length > 0 && confirm.length > 0 && !saving;

  async function handleSave() {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error: saveError } = await changePassword(password);
    setSaving(false);
    if (saveError) {
      setError(mapAuthError(saveError).message);
      return;
    }
    Alert.alert('Password updated', 'Use your new password next time you sign in.');
    router.back();
  }

  return (
    <Screen style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Change password</Text>
        <Pressable
          hitSlop={touchTarget.min}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            width: touchTarget.min,
            height: touchTarget.min,
            borderRadius: radius.button,
            backgroundColor: colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...type.title, color: colors.textPrimary }}>✕</Text>
        </Pressable>
      </View>

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
        onSubmitEditing={handleSave}
        error={!!error}
      />
      <FieldError message={error} />

      <Button label="Save" loadingLabel="Saving…" onPress={handleSave} disabled={!canSave} loading={saving} />
    </Screen>
  );
}
