/**
 * /edit-profile — reached from Settings. The one place the app touches the camera
 * roll (spec §4 bans it everywhere else), and only for the avatar. Two edits: the
 * avatar (tap to pick, uploads immediately) and the username (live availability +
 * an explicit Save). Back returns to Settings.
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { updateAvatar, updateUsername, useProfile } from '@lib/profile';
import { useUsernameStatus, usernameStatusMessage } from '@lib/username';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, space, typeScale } from '@/components/tokens';

const AVATAR_SIZE = 104;

export default function EditProfileScreen() {
  const router = useRouter();
  const { data, refresh } = useProfile(null);

  const [name, setName] = useState('');
  const seeded = useRef(false);
  const [preview, setPreview] = useState<string | null>(null); // optimistic local avatar
  const [busyAvatar, setBusyAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Seed the field from the loaded profile exactly once, so typing isn't clobbered
  // by a later cache refresh.
  useEffect(() => {
    if (!seeded.current && data?.username) {
      setName(data.username);
      seeded.current = true;
    }
  }, [data]);

  const uStatus = useUsernameStatus(name, true, data?.username);
  const uMessage = usernameStatusMessage(uStatus);
  const changed = data ? name.trim().toLowerCase() !== data.username.toLowerCase() : false;
  const canSave =
    changed && name.trim().length >= 3 && uStatus !== 'taken' && uStatus !== 'short' && uStatus !== 'checking';

  const avatarUri = preview ?? data?.avatarUrl ?? null;

  const pickAvatar = async () => {
    if (busyAvatar) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setToast('Photo access is off. Turn it on in your phone settings.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;

    const local = res.assets[0].uri;
    setPreview(local);
    setBusyAvatar(true);
    const url = await updateAvatar(local);
    setBusyAvatar(false);
    if (url) {
      await refresh();
      setToast('Photo updated');
    } else {
      setPreview(null); // roll the optimistic preview back on failure
      setToast("Couldn't update your photo");
    }
  };

  const saveName = async () => {
    setSaving(true);
    const r = await updateUsername(name);
    setSaving(false);
    if (r.ok) {
      await refresh();
      setToast('Username updated');
    } else {
      setToast(r.error ?? "Couldn't update your username");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Edit profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}
            onPress={() => void pickAvatar()}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" transition={100} />
            ) : (
              <Camera size={30} strokeWidth={2.25} color={colors.safelight} />
            )}
          </Pressable>
          <Text style={styles.avatarHint}>{busyAvatar ? 'Uploading…' : 'Tap to change photo'}</Text>
        </View>

        <View style={styles.usernameSection}>
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
            USERNAME
          </Mono>
          <Field
            label="Username"
            value={name}
            onChangeText={setName}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. goldenhour"
            hint={changed ? undefined : 'This is public. People find and follow you by it.'}
          />
          {uMessage && <Text style={[styles.uStatus, uMessage.error && styles.uStatusError]}>{uMessage.text}</Text>}
          <View style={styles.saveRow}>
            <Button label="Save" onPress={() => void saveName()} loading={saving} disabled={!canSave} fullWidth />
          </View>
        </View>
      </ScrollView>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.gutter - 4, paddingTop: 4 },
  title: { fontFamily: displayFamily, fontSize: typeScale.title, color: colors.paper },
  content: { padding: space.gutter, paddingBottom: 48, gap: 32 },
  avatarBlock: { alignItems: 'center', gap: 12, paddingTop: 8 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.ink2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatarHint: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  usernameSection: { gap: 10 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: 4 },
  uStatus: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  uStatusError: { color: colors.safelight },
  saveRow: { marginTop: 8 },
});
