/**
 * Own profile — thin wrapper over the shared ProfileView. The gear opens a
 * settings sheet (spec §11c): sign out + account deletion with a confirm step.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteAccount, useProfile, type ProfileWin } from '@lib/profile';
import { supabase } from '@lib/supabase';
import { Button } from '@/components/atoms/Button';
import { ProfileView } from '@/components/ProfileView';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, typeScale } from '@/components/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useProfile(null);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const closeSettings = () => {
    setShowSettings(false);
    setConfirmDelete(false);
  };

  const onDelete = async () => {
    setBusy(true);
    const ok = await deleteAccount();
    setBusy(false);
    if (ok) {
      closeSettings();
      await supabase.auth.signOut(); // session is now invalid → back to auth
    }
  };

  const openWin = (w: ProfileWin, username: string) => {
    router.push({
      pathname: '/photo/[id]',
      params: { id: w.id, path: w.thumbPath ?? '', shooter: username, potd: w.isPotd ? '1' : '', user: data?.id ?? '' },
    });
  };

  return (
    <>
      <ProfileView
        data={data}
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        onSettings={() => setShowSettings(true)}
        onOpenWin={openWin}
      />

      <Sheet visible={showSettings} onClose={closeSettings} title={confirmDelete ? 'Delete account?' : 'Settings'}>
        {!confirmDelete ? (
          <>
            <Button label="Sign out" variant="ghost" fullWidth onPress={() => void supabase.auth.signOut()} />
            <Pressable accessibilityRole="button" style={styles.deleteRow} onPress={() => setConfirmDelete(true)}>
              <Text style={styles.deleteText}>Delete account</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.warn}>
              This permanently deletes your account, every shot, and all your stats. It cannot be undone.
            </Text>
            <Button label="Keep my account" variant="primary" fullWidth onPress={() => setConfirmDelete(false)} />
            <Pressable accessibilityRole="button" style={styles.deleteRow} disabled={busy} onPress={() => void onDelete()}>
              <Text style={styles.deleteText}>{busy ? 'Deleting…' : 'Delete forever'}</Text>
            </Pressable>
            <View style={styles.pad} />
          </>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  deleteRow: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.heart },
  warn: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center' },
  pad: { height: 4 },
});
