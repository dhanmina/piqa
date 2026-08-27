import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { updateDisplayName } from '../lib/profile';
import { Screen } from '../components/Screen';
import { FilledField } from '../components/FilledField';
import { FieldError } from '../components/FieldError';
import { Button } from '../components/Button';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

export default function EditProfile() {
  const { displayName } = useLocalSearchParams<{ displayName?: string }>();
  const [name, setName] = useState(displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !saving;

  async function handleSave() {
    setError(null);
    setSaving(true);
    const { error: saveError } = await updateDisplayName(trimmed);
    setSaving(false);
    if (saveError) {
      setError("Couldn't save. Check your connection and try again.");
      return;
    }
    router.back();
  }

  return (
    <Screen style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Edit profile</Text>
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
        placeholder="Display name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        returnKeyType="done"
        onSubmitEditing={handleSave}
        error={!!error}
      />
      <FieldError message={error} />

      <Button label="Save" loadingLabel="Saving…" onPress={handleSave} disabled={!canSave} loading={saving} />
    </Screen>
  );
}
