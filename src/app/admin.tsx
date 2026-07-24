/**
 * /admin — the admin dashboard hub. Entry point for all admin operations.
 * Shows platform stats at a glance, quick links to sub-screens, engagement
 * metrics, and recent PotD crowns. Replaces the old content-only panel
 * (now at /admin-content).
 */
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  ClipboardList,
  Crown,
  Hourglass,
  LayoutGrid,
  Users,
} from 'lucide-react-native';

import { useAdminToday, useAnalytics, useEngagement } from '@lib/hooks/useAdmin';
import { S } from '@lib/utils/admin-strings';
import { Mono } from '@/components/atoms/Mono';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { colors, fonts, iconStroke, icons, radius, space, typeScale } from '@/components/tokens';

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statCard}>
      <Mono size={typeScale.title} color={colors.paper} style={styles.statValue}>
        {value}
      </Mono>
      <Mono size={10} color={colors.paper60} style={styles.statLabel}>
        {label.toUpperCase()}
      </Mono>
    </View>
  );
}

// ─── Action row ──────────────────────────────────────────────────────────────

function ActionRow({
  icon: Icon,
  label,
  badge,
  onPress,
}: {
  icon: typeof Users;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
      onPress={onPress}
    >
      <View style={styles.actionLeft}>
        <Icon size={18} strokeWidth={iconStroke(18)} color={colors.paper60} />
        <Text style={styles.actionLabel}>{label}</Text>
      </View>
      <View style={styles.actionRight}>
        {badge != null && badge > 0 ? (
          <View style={styles.badge}>
            <Mono size={10} color={colors.ink}>{badge}</Mono>
          </View>
        ) : null}
        <ChevronRight size={16} strokeWidth={icons.strokeWidth} color={colors.paper40} />
      </View>
    </Pressable>
  );
}

// ─── Engagement row ──────────────────────────────────────────────────────────

function EngRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.engRow}>
      <Mono size={typeScale.caption} color={colors.paper60}>{label}</Mono>
      <Mono size={typeScale.caption} color={colors.paper}>{value}</Mono>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const router = useRouter();
  const { data: today, loading: todayLoading, error: todayError, refresh: refreshToday } = useAdminToday();
  const { data: analytics, loading: analyticsLoading } = useAnalytics();
  const { data: engagement, loading: engLoading } = useEngagement();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshToday();
    setRefreshing(false);
  }, [refreshToday]);

  const drop = today?.drop ?? null;
  const totals = analytics?.totals;
  const latestEng = engagement?.totals;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={S.hubTitle} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />}
      >
        {/* ── Stats strip ─────────────────────────────────────────────── */}
        {analyticsLoading ? (
          <ActivityIndicator color={colors.paper60} style={{ marginTop: 24 }} />
        ) : totals ? (
          <View style={styles.statsStrip}>
            <StatCard label={S.hubStatsPhotographers} value={totals.users} />
            <StatCard label={S.hubStatsSubmissions} value={totals.submissions} />
            <StatCard label={S.hubStatsActiveStreaks} value={latestEng?.active_streaks ?? '—'} />
            <StatCard label={S.hubStatsPro} value={latestEng?.total_premium ?? '—'} />
          </View>
        ) : null}

        {/* ── Today's drop (compact) ──────────────────────────────────── */}
        <View style={styles.section}>
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
            {S.hubTodayTitle}
          </Mono>
          <View style={styles.card}>
            {todayLoading && !drop ? (
              <ActivityIndicator color={colors.paper60} style={{ padding: 20 }} />
            ) : todayError ? (
              <Text style={styles.muted}>{todayError === 'not_authorized' ? S.notAuthorized : todayError}</Text>
            ) : drop ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${S.contentToday} — ${drop.subject_text}`}
                style={({ pressed }) => [styles.todayInner, pressed && styles.todayInnerPressed]}
                onPress={() => router.push('/admin-content')}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.todaySubject}>{drop.subject_text}</Text>
                  <View style={styles.todayMeta}>
                    <Mono size={10} color={drop.status === 'live' ? colors.safelight : colors.paper40}>
                      {drop.status.toUpperCase()}
                    </Mono>
                    <Mono size={10} color={colors.paper40}>· {today?.region}</Mono>
                    {drop.is_golden ? (
                      <Mono size={10} color={colors.crown}>· GOLDEN</Mono>
                    ) : null}
                  </View>
                </View>
                <ChevronRight size={16} strokeWidth={icons.strokeWidth} color={colors.paper40} />
              </Pressable>
            ) : (
              <Text style={styles.muted}>{S.hubTodayEmpty.replace('{region}', today?.region ?? 'your region')}</Text>
            )}
          </View>
        </View>

        {/* ── Quick actions ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
            {S.hubQuickActions}
          </Mono>
          <View style={styles.card}>
            <ActionRow icon={Camera} label={S.hubActionContent} onPress={() => router.push('/admin-content')} />
            <View style={styles.divider} />
            <ActionRow icon={LayoutGrid} label={S.hubActionLibrary} onPress={() => router.push('/admin-library')} />
            <View style={styles.divider} />
            <ActionRow icon={Users} label={S.hubActionMembers} onPress={() => router.push('/admin-members')} />
            <View style={styles.divider} />
            <ActionRow
              icon={AlertTriangle}
              label={S.hubActionModeration}
              badge={totals?.pending_reports}
              onPress={() => router.push('/admin-moderation')}
            />
            <View style={styles.divider} />
            <ActionRow icon={ClipboardList} label={S.hubActionAudit} onPress={() => router.push('/admin-audit')} />
            <View style={styles.divider} />
            <ActionRow icon={Hourglass} label={S.hubActionWaitlist} onPress={() => router.push('/admin-waitlist')} />
          </View>
        </View>

        {/* ── Engagement ──────────────────────────────────────────────── */}
        {engagement && engagement.daily.length > 0 ? (
          <View style={styles.section}>
            <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
              {S.hubEngagement}
            </Mono>
            <View style={styles.card}>
              <View style={styles.engBody}>
                <EngRow label={S.hubEngagementSubmitters} value={latestEng?.active_streaks ?? 0} />
                <EngRow label={S.hubEngagementVoters} value={latestEng?.total_reactions ?? 0} />
                <EngRow label={S.hubEngagementRate} value={`${latestEng?.avg_streak_weeks ?? 0} wk avg`} />
                <View style={styles.engDivider} />
                {engagement.daily.slice(-7).reverse().map((d) => (
                  <View key={d.date} style={styles.engDayRow}>
                    <Mono size={11} color={colors.paper40}>{d.date.slice(5)}</Mono>
                    <View style={styles.engBarWrap}>
                      <View
                        style={[
                          styles.engBar,
                          {
                            width: `${Math.min(100, d.unique_submitters > 0
                              ? (d.unique_voters / d.unique_submitters) * 100
                              : 0)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Mono size={11} color={colors.paper60}>
                      {d.unique_submitters}/{d.unique_voters}
                    </Mono>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : engLoading ? null : null}

        {/* ── Recent crowns ───────────────────────────────────────────── */}
        {analytics && analytics.crowns.length > 0 ? (
          <View style={styles.section}>
            <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
              {S.hubRecentCrowns}
            </Mono>
            <View style={styles.card}>
              {analytics.crowns.map((c, i) => (
                <View key={`${c.date}-${c.region}`}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.crownRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Mono size={typeScale.caption} color={colors.paper}>
                        {c.shooter ? `@${c.shooter}` : S.hubCrownNoWinner}
                      </Mono>
                      <Mono size={10} color={colors.paper40}>{c.region} · {c.date}</Mono>
                    </View>
                    <View style={styles.crownRight}>
                      <Crown size={12} strokeWidth={iconStroke(12)} color={colors.crown} />
                      <Mono size={typeScale.caption} color={colors.paper60}>{c.votes}</Mono>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 48, gap: 26 },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontFamily: 'IBMPlexMono_500Medium' },
  statLabel: { letterSpacing: 0.8, textAlign: 'center' },

  // Sections
  section: { gap: 8 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: 4 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30 },

  // Today
  todayInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  todayInnerPressed: { backgroundColor: colors.ink },
  todaySubject: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  todayMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: space.target,
    paddingHorizontal: 14,
  },
  actionRowPressed: { backgroundColor: colors.ink },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  actionLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  actionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    backgroundColor: colors.safelight,
    borderRadius: radius.pill,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  // Engagement
  engBody: { padding: 14, gap: 10 },
  engRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  engDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginVertical: 4 },
  engDayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  engBarWrap: { flex: 1, height: 4, backgroundColor: colors.ink, borderRadius: 2, overflow: 'hidden' },
  engBar: { height: 4, backgroundColor: colors.safelight, borderRadius: 2 },

  // Crowns
  crownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  crownRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  muted: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center', padding: 20 },
});
