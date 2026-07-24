/**
 * /admin-waitlist — view and manage the pre-launch waitlist. Shows emails and
 * signup dates, with delete action per row.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Hourglass } from 'lucide-react-native';

import { deleteWaitlist, useWaitlist, type WaitlistEntry } from '@lib/admin';
import { S } from '@lib/admin-strings';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

function WaitlistRow({
  entry,
  onRemove,
}: {
  entry: WaitlistEntry;
  onRemove: (email: string) => void;
}) {
  const date = new Date(entry.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.email}>{entry.email}</Text>
        <Mono size={10} color={colors.paper40}>{date}</Mono>
      </View>
      <Button label={S.waitlistDelete} variant="text" onPress={() => onRemove(entry.email)} />
    </View>
  );
}

export default function AdminWaitlistScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useWaitlist();
  const [toast, setToast] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const onRemove = (email: string) => {
    Alert.alert(S.waitlistDelete, email, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: S.waitlistDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWaitlist(email);
            setToast(S.waitlistRemoved);
            refresh();
          } catch (e) {
            Alert.alert(S.waitlistError, String((e as Error).message));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={S.waitlistTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />}
      >
        {loading && !data ? (
          <ActivityIndicator color={colors.paper60} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error === 'not_authorized' ? S.notAuthorized : error}</Text>
        ) : !data || data.length === 0 ? (
          <EmptyState icon={Hourglass} line={S.waitlistEmpty} />
        ) : (
          <View style={styles.card}>
            {data.map((entry) => (
              <View key={entry.email}>
                <WaitlistRow entry={entry} onRemove={onRemove} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      <Toast message={toast} visible={toast !== ''} onHide={() => setToast('')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 64, gap: 16 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: space.target,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.paper30,
  },
  email: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  error: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.safelight, textAlign: 'center', marginTop: 24 },
});
