/**
 * /admin-moderation — review flagged submissions. Shows thumbnails, reporter
 * counts, reasons, quarantine status. Uses admin_list_reports RPC.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';

import { useReports } from '@lib/hooks/useAdmin';
import type { ReportEntry } from '@lib/services/admin';
import { S } from '@lib/utils/admin-strings';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

function ReportRow({ r }: { r: ReportEntry }) {
  const [open, setOpen] = useState(false);
  const reasons = Object.entries(r.reasons);
  const reportLabel = r.reporters === 1 ? S.moderationReporters.replace('{count}', String(r.reporters)).replace('{s}', '') : S.moderationReporters.replace('{count}', String(r.reporters)).replace('{s}', 's');

  return (
    <View style={styles.reportCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Report by ${r.shooter}`}
        accessibilityState={{ expanded: open }}
        style={styles.reportHead}
        onPress={() => setOpen((o) => !o)}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.shooterRow}>
            <Text style={styles.shooter}>@{r.shooter}</Text>
            {r.quarantined ? (
              <View style={styles.quarantineTag}>
                <Mono size={9} color={colors.ink}>{S.moderationQuarantined}</Mono>
              </View>
            ) : null}
          </View>
          <View style={styles.reportMeta}>
            <Mono size={10} color={colors.safelight}>· {reportLabel}</Mono>
            <Mono size={10} color={colors.paper40}>· {r.drop_date}</Mono>
            {r.in_gallery ? <Mono size={10} color={colors.paper40}>· {S.moderationInGallery}</Mono> : null}
          </View>
        </View>
        <Mono size={typeScale.caption} color={colors.paper40}>{r.reporters}</Mono>
      </Pressable>

      {open ? (
        <View style={styles.reportBody}>
          <View style={styles.reasonsRow}>
            <Mono size={10} color={colors.paper60}>{S.moderationReasons}:</Mono>
            {reasons.map(([reason, count]) => (
              <View key={reason} style={styles.reasonChip}>
                <Mono size={10} color={colors.paper}>{reason} ×{count}</Mono>
              </View>
            ))}
          </View>
          <Text style={styles.muted}>
            Threshold: {r.threshold} reports · {r.reporters} received
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminModerationScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useReports();
  const [toast, setToast] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={S.moderationTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />}
      >
        {loading && !data ? (
          <ActivityIndicator color={colors.paper60} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error === 'not_authorized' ? S.notAuthorized : error}</Text>
        ) : !data || data.length === 0 ? (
          <EmptyState icon={ShieldCheck} line={S.moderationEmpty} />
        ) : (
          <View style={{ gap: 8 }}>
            {data.map((r) => (
              <ReportRow key={r.submission_id} r={r} />
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
  reportCard: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  reportHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.smPlus },
  shooterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shooter: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  quarantineTag: {
    backgroundColor: colors.safelight,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxsPlus,
    paddingVertical: space.hair,
  },
  reportMeta: { flexDirection: 'row', alignItems: 'center', gap: space.xxsPlus, flexWrap: 'wrap' },
  reportBody: { paddingHorizontal: space.smPlus, paddingBottom: space.smPlus, gap: space.xsPlus },
  reasonsRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxsPlus, flexWrap: 'wrap' },
  reasonChip: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
  },
  muted: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper40 },
  error: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.safelight, textAlign: 'center', marginTop: 24 },
});
