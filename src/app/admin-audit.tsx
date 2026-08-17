/**
 * /admin-audit — feed of all admin actions (security audit trail). Shows actor,
 * action, entity, timestamp. Tap to expand before/after JSON diff.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClipboardList } from 'lucide-react-native';

import { useAuditFeed } from '@lib/hooks/useAdmin';
import type { AuditEntry } from '@lib/services/admin';
import { S } from '@lib/utils/admin-strings';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const time = new Date(entry.at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.auditCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.action} by ${entry.actor}`}
        accessibilityState={{ expanded: open }}
        style={styles.auditHead}
        onPress={() => setOpen((o) => !o)}
      >
        <View style={{ flex: 1, gap: space.hair }}>
          <View style={styles.actionRow}>
            <Mono size={typeScale.caption} color={colors.paper}>{entry.action}</Mono>
            <Mono size={10} color={colors.paper40}>· {entry.entity}</Mono>
          </View>
          <Mono size={10} color={colors.paper60}>
            {S.auditBy} {entry.actor === 'system' ? S.auditSystem : `@${entry.actor}`} · {time}
          </Mono>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.auditBody}>
          {entry.before ? (
            <View style={styles.jsonBlock}>
              <Mono size={10} color={colors.paper40}>BEFORE</Mono>
              <Mono size={11} color={colors.paper60}>{JSON.stringify(entry.before, null, 2)}</Mono>
            </View>
          ) : null}
          {entry.after ? (
            <View style={styles.jsonBlock}>
              <Mono size={10} color={colors.paper40}>AFTER</Mono>
              <Mono size={11} color={colors.paper60}>{JSON.stringify(entry.after, null, 2)}</Mono>
            </View>
          ) : null}
          <Mono size={10} color={colors.paper30}>ID: {entry.entity_id}</Mono>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminAuditScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAuditFeed();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={S.auditTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />}
      >
        {loading && !data ? (
          <ActivityIndicator color={colors.paper60} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error === 'not_authorized' ? S.notAuthorized : error}</Text>
        ) : !data || data.length === 0 ? (
          <EmptyState icon={ClipboardList} line={S.auditEmpty} />
        ) : (
          <View style={{ gap: 8 }}>
            {data.map((entry, i) => (
              <AuditRow key={`${entry.at}-${i}`} entry={entry} />
            ))}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 64, gap: 8 },
  auditCard: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  auditHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.smPlus },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxsPlus },
  auditBody: { paddingHorizontal: space.smPlus, paddingBottom: space.smPlus, gap: space.xsPlus },
  jsonBlock: { gap: 4 },
  error: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.safelight, textAlign: 'center', marginTop: 24 },
});
