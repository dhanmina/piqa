import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { updateDisplayName, uploadAvatar } from '../lib/profile';
import { Screen } from '../components/Screen';
import { FilledField } from '../components/FilledField';
import { FieldError } from '../components/FieldError';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

const AVATAR_SIZE = 96;
// Comfortably larger than the display size so the plate stays sharp, without
// uploading whatever multi-megapixel resolution the picker happened to return.
const AVATAR_UPLOAD_DIMENSION = 512;

export default function EditProfile() {
  const { displayName, avatarUrl: initialAvatarUrl } = useLocalSearchParams<{
    displayName?: string;
    avatarUrl?: string;
  }>();
  const [name, setName] = useState(displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !saving;

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError('piqa needs photo access to change your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;

    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const resized = await ImageManipulator.manipulate(result.assets[0].uri)
        .resize({ width: AVATAR_UPLOAD_DIMENSION, height: AVATAR_UPLOAD_DIMENSION })
        .renderAsync();
      const saved = await resized.saveAsync({ compress: 0.9 });
      const { url, error: uploadError } = await uploadAvatar(saved.uri);
      if (uploadError || !url) {
        setAvatarError("Couldn't update your photo. Try again.");
      } else {
        setAvatarUrl(url);
      }
    } catch {
      setAvatarError("Couldn't update your photo. Try again.");
    } finally {
      setAvatarUploading(false);
    }
  }

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

      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
        <Avatar
          url={avatarUrl}
          name={name}
          size={AVATAR_SIZE}
          editable
          uploading={avatarUploading}
          onPress={pickAvatar}
          accessibilityLabel="Your profile photo"
        />
        <FieldError message={avatarError} />
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
