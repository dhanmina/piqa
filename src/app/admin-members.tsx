/**
 * /admin-members — search and manage photographers. Toggle Piqa Pro, grant/revoke
 * admin, view submission counts and streaks. Uses admin_search_users RPC.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users } from 'lucide-react-native';

import { setAdmin, setPremium, useMembers, type Member } from '@lib/admin';
import { S } from '@lib/admin-strings';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Toast } from '@/components/molecules/Toast';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

function MemberRow({
  m,
  onAction,
}: {
  m: Member;
  onAction: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const togglePremium = async () => {
    setBusy(true);
    try {
      await setPremium(m.id, !m.is_premium);
      onAction();
    } catch (e) {
      Alert.alert(S.membersError, String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const toggleAdmin = async () => {
    setBusy(true);
    try {
      await setAdmin(m.id, !m.is_admin);
      onAction();
    } catch (e) {
      Alert.alert(S.membersError, String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.memberCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${m.username}`}
        accessibilityState={{ expanded: open }}
        style={styles.memberHead}
        onPress={() => setOpen((o) => !o)}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{m.username}</Text>
            {m.is_premium ? (
              <View style={styles.badgePro}>
                <Mono size={9} color={colors.ink}>{S.membersPremium}</Mono>
              </View>
            ) : null}
            {m.is_admin ? (
              <View style={styles.badgeAdmin}>
                <Mono size={9} color={colors.paper}>{S.membersAdmin}</Mono>
              </View>
            ) : null}
          </View>
          <View style={styles.memberMeta}>
            <Mono size={10} color={colors.paper40}>{m.region}</Mono>
            <Mono size={10} color={colors.paper60}>· {m.submissions} {S.membersSubmissions}</Mono>
            {m.crowns > 0 ? <Mono size={10} color={colors.crown}>· {m.crowns} crown{m.crowns > 1 ? 's' : ''}</Mono> : null}
            {m.current_weeks > 0 ? <Mono size={10} color={colors.paper40}>· {m.current_weeks} {S.membersStreak}</Mono> : null}
          </View>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.actions}>
          <Button
            label={m.is_premium ? S.membersRevokePro : S.membersGrantPro}
            variant={m.is_premium ? 'ghost' : 'primary'}
            onPress={togglePremium}
            loading={busy}
            fullWidth
          />
          <Button
            label={m.is_admin ? S.membersRevokeAdmin : S.membersGrantAdmin}
            variant="ghost"
            onPress={toggleAdmin}
            loading={busy}
            fullWidth
          />
        </View>
      ) : null}
    </View>
  );
}

export default function AdminMembersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { data, loading, error, refresh } = useMembers(debouncedQuery);
  const [toast, setToast] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Debounce search
  const onSearch = (text: string) => {
    setQuery(text);
    // Simple debounce: set debounced after a short delay
    setTimeout(() => setDebouncedQuery(text), 300);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title={S.membersTitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paper60} />}
      >
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onSearch}
          placeholder={S.membersSearch}
          placeholderTextColor={colors.paper40}
          accessibilityLabel={S.membersSearch}
        />

        {loading && data.length === 0 ? (
          <ActivityIndicator color={colors.paper60} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error === 'not_authorized' ? S.notAuthorized : error}</Text>
        ) : data.length === 0 ? (
          <EmptyState icon={Users} line={S.membersEmpty} />
        ) : (
          <View style={{ gap: 8 }}>
            {data.map((m) => (
              <MemberRow key={m.id} m={m} onAction={() => { refresh(); setToast(S.membersPromoted); }} />
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
  searchInput: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper,
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paper30,
    padding: 12,
    minHeight: 44,
  },
  memberCard: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  badgePro: {
    backgroundColor: colors.crown,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeAdmin: {
    backgroundColor: colors.safelight,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  actions: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  error: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.safelight, textAlign: 'center', marginTop: 24 },
});
