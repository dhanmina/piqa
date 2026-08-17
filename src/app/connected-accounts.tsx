/**
 * /connected-accounts — reached from Settings > Account. Read-only: which
 * sign-in methods are linked to this account. Apple isn't listed — it's not
 * wired yet (deferred until iOS work starts, see docs/build-roadmap.md), so a
 * "Not connected" row for it would read as a broken feature, not a fact.
 */
import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@lib/session';
import { Mono } from '@/components/atoms/Mono';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

export default function ConnectedAccountsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const identities = session?.user.identities ?? [];
  const googleLinked = identities.some((i) => i.provider === 'google');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Connected accounts" />

      <View style={styles.content}>
        <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
          SIGN-IN METHODS
        </Mono>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Email & password</Text>
              <Text style={styles.value}>{session?.user.email ?? '—'}</Text>
            </View>
            <CircleCheck size={20} strokeWidth={icons.strokeWidth} color={colors.safelight} />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.label}>Google</Text>
              <Text style={styles.value}>{googleLinked ? 'Connected' : 'Not connected'}</Text>
            </View>
            {googleLinked ? (
              <CircleCheck size={20} strokeWidth={icons.strokeWidth} color={colors.safelight} />
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, gap: 8 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: 4 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  row: {
    minHeight: space.target,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: space.smPlus,
    paddingVertical: space.xsPlus,
  },
  rowText: { flexShrink: 1, gap: 2 },
  label: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  value: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginLeft: space.smPlus },
});
