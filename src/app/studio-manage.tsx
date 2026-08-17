/**
 * /studio-manage — Director only (spec: rename/remove/delete are Director powers;
 * any member can invite). Mirrors settings.tsx's own shape: the ordinary stuff
 * first, the irreversible action last.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStudio, useStudioMembers } from '@lib/hooks/studios';
import { deleteStudio, removeStudioMember, renameStudio } from '@lib/services/studios';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Field } from '@/components/atoms/Field';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
import { avatar, colors, fonts, space, typeScale } from '@/components/tokens';

export default function StudioManageScreen() {
  const router = useRouter();
  const { data: studio, refresh: refreshStudio } = useStudio();
  const { data: members, refresh: refreshMembers } = useStudioMembers();
  const [name, setName] = useState(studio?.name ?? '');
  const [savedName] = useState(studio?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showRemove, setShowRemove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onSave = async () => {
    const clean = name.trim();
    if (clean.length < 2 || clean === savedName) return;
    setBusy(true);
    const res = await renameStudio(clean);
    setBusy(false);
    if (res.ok) {
      setToast('Studio renamed');
      void refreshStudio();
    } else {
      setToast('Could not rename your Studio');
    }
  };

  const onRemove = async (userId: string) => {
    const res = await removeStudioMember(userId);
    if (res.ok) void refreshMembers();
  };

  const onDelete = async () => {
    setBusy(true);
    const res = await deleteStudio();
    setBusy(false);
    if (res.ok) {
      // Manage/Members have nothing left to show once the Studio is gone —
      // replace back to the tab root, which re-fetches into the empty state.
      router.replace('/(tabs)/studios');
    }
  };

  const removable = (members ?? []).filter((m) => m.role !== 'director');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Manage Studio" />

      <View style={styles.content}>
        <Field label="Studio name" value={name} onChangeText={setName} maxLength={40} />
        <Button label="Save changes" variant="ghost" fullWidth loading={busy} onPress={() => void onSave()} />

        <View style={styles.spacer} />

        <Button label="Remove a member…" variant="text" onPress={() => setShowRemove(true)} />
        <Button label="Delete Studio" variant="text" onPress={() => setConfirmDelete(true)} />
      </View>

      <Sheet visible={showRemove} onClose={() => setShowRemove(false)} title="Remove a member">
        {removable.length === 0 ? (
          <Text style={styles.emptyLine}>No other members yet.</Text>
        ) : (
          removable.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <Avatar uri={m.avatarUrl} username={m.username} size={avatar.sm} />
              <Text style={styles.memberName} numberOfLines={1}>@{m.username}</Text>
              <Button label="Remove" variant="text" compact onPress={() => void onRemove(m.id)} />
            </View>
          ))
        )}
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this Studio?">
        <Text style={styles.confirmLine}>
          Every member loses access immediately. This can’t be undone — they’d need a brand new Studio to play together again.
        </Text>
        <Button label="Keep the Studio" variant="primary" fullWidth onPress={() => setConfirmDelete(false)} />
        <Button label={busy ? 'Deleting…' : 'Delete forever'} variant="text" onPress={() => void onDelete()} disabled={busy} />
      </Sheet>

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 20, gap: 12 },
  spacer: { height: 20 },
  emptyLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.xsPlus, paddingVertical: space.xxsPlus },
  memberName: { flex: 1, fontFamily: fonts.sans, fontSize: typeScale.body, color: colors.paper },
  confirmLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
});
