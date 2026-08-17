/**
 * /studio-members — the unordered roster (director/join-order, never resorted by
 * performance). Each check mark is presence-only ("shot today: yes/no") — never a
 * count or anything comparable between members (see docs/design-review/07).
 * Director gets a settings gear here (the mockup left the header empty, but
 * Manage needs a real entry point, and the roster is the natural one); everyone
 * else gets a plain "Leave Studio" instead.
 */
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { plural } from '@lib/utils/format';
import { useStudio, useStudioMembers } from '@lib/hooks/studios';
import { leaveStudio } from '@lib/services/studios';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, space, typeScale } from '@/components/tokens';

export default function StudioMembersScreen() {
  const router = useRouter();
  const { data: studio } = useStudio();
  const { data: members, loading, refresh } = useStudioMembers();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLeave = async () => {
    setBusy(true);
    const res = await leaveStudio();
    setBusy(false);
    if (res.ok) {
      setConfirmLeave(false);
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        onBack={() => router.back()}
        title={members ? `${members.length} ${plural(members.length, 'Member', 'Members')}` : 'Members'}
        right={
          studio?.isDirector ? (
            <IconButton icon={Settings} accessibilityLabel="Manage Studio" onPress={() => router.push('/studio-manage')} />
          ) : undefined
        }
      />

      <FlatList
        data={members ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={() => void refresh()}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar uri={item.avatarUrl} username={item.username} size={40} />
            <Text style={styles.name} numberOfLines={1}>@{item.username}</Text>
            {item.role === 'director' && (
              <Mono size={typeScale.caption} color={colors.paper40} style={styles.tag}>DIRECTOR</Mono>
            )}
            <Text style={[styles.mark, item.submittedToday ? styles.markOn : styles.markOff]}>
              {item.submittedToday ? '✓' : '–'}
            </Text>
          </View>
        )}
      />

      {studio && !studio.isDirector && (
        <View style={styles.footer}>
          <Button label="Leave Studio" variant="text" onPress={() => setConfirmLeave(true)} />
        </View>
      )}

      <Sheet visible={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this Studio?">
        <Text style={styles.confirmLine}>
          You’ll stop seeing this Studio’s shared progress. Anyone can invite you back with a new code.
        </Text>
        <Button label="Stay" variant="primary" fullWidth onPress={() => setConfirmLeave(false)} />
        <Button label={busy ? 'Leaving…' : 'Leave Studio'} variant="text" onPress={() => void onLeave()} disabled={busy} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: space.xsPlus },
  name: { flex: 1, fontFamily: fonts.sans, fontSize: typeScale.body, color: colors.paper },
  tag: { letterSpacing: 1 },
  mark: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, width: 20, textAlign: 'center' },
  markOn: { color: colors.safelight },
  markOff: { color: colors.paper30 },
  footer: { paddingHorizontal: 20, paddingBottom: 12 },
  confirmLine: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60 },
});
