/**
 * Own profile — thin wrapper over the shared ProfileView. The gear opens a
 * settings sheet (spec §11c): sign out + account deletion with a confirm step.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { claimEventFrame, equipFrame, type FrameId } from '@lib/frames';
import { deleteAccount, useProfile } from '@lib/profile';
import { supabase } from '@lib/supabase';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { ProfileView } from '@/components/ProfileView';
import { FramePicker } from '@/components/molecules/FramePicker';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, space, typeScale } from '@/components/tokens';

export default function ProfileScreen() {
  const { data, loading, error, refresh } = useProfile(null);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [equipping, setEquipping] = useState(false);

  const closeSettings = () => {
    setShowSettings(false);
    setConfirmDelete(false);
  };

  // Equipping touches no photo — it flips one column, and every framed surface
  // re-reads it. So all this has to do is refetch the profile.
  const onEquip = async (id: FrameId) => {
    setEquipping(true);
    const ok = await equipFrame(id);
    setEquipping(false);
    if (ok) await refresh();
  };

  // Claiming an event frame grants ownership (server-verified against its window),
  // then the profile refetch surfaces it as equippable.
  const onClaim = async (id: FrameId) => {
    setEquipping(true);
    const ok = await claimEventFrame(id);
    setEquipping(false);
    if (ok) await refresh();
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

  return (
    <>
      <ProfileView
        data={data}
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        onSettings={() => setShowSettings(true)}
      />

      <Sheet visible={showSettings} onClose={closeSettings} title={confirmDelete ? 'Delete account?' : 'Settings'}>
        {!confirmDelete ? (
          <>
            <View style={styles.frameBlock}>
              <Mono size={typeScale.caption} color={colors.paper60}>
                FRAME
              </Mono>
              <FramePicker
                equipped={data?.equippedFrame ?? 'default'}
                owned={data?.ownedFrames ?? []}
                previewUri={data?.wins[0]?.uri}
                previewDay={data?.wins[0]?.dayNumber ?? 1}
                busy={equipping}
                onEquip={(id) => void onEquip(id)}
                onClaim={(id) => void onClaim(id)}
              />
            </View>
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
  frameBlock: { alignSelf: 'stretch', gap: 10, marginBottom: space.gridGap },
  deleteRow: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.heart },
  warn: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center' },
  pad: { height: 4 },
});
