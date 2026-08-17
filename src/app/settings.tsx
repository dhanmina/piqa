/**
 * /settings — the own-profile control panel, a route (not a sheet) so it has room
 * for grouped sections and back returns to Profile. Order runs top-down by emotional
 * weight: the nice stuff first (customization), the irreversible last (danger zone),
 * so "equip a frame" never sits a tap above "delete account" the way it did in the
 * old flat sheet. The frame picker stays a focused sheet launched from here.
 */
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useIsAdmin } from '@lib/hooks/useAdmin';
import { S } from '@lib/utils/admin-strings';
import { equipFrame } from '@lib/services/frames';
import type { FrameId } from '@lib/services/frames';
import { useNotifPrefs } from '@lib/notifPrefs';
import { deleteAccount, exportMyData } from '@lib/services/profile';
import { useProfile } from '@lib/hooks/useProfile';
import { useSession } from '@lib/session';
import { supabase } from '@lib/services/supabase';
import { levelProgress } from '@lib/utils/xp';
import { getConsentSync, setConsent } from '@lib/analyticsConsent';
import { getWifiOnlySync, setWifiOnly } from '@lib/uploadPrefs';
import { wakeCaptureQueue } from '@lib/services/captureQueue';
import { clearCache, getCacheSize } from '@lib/services/cacheStorage';
import { getGridEnabledSync, getMirrorEnabledSync, setGridEnabled, setMirrorEnabled } from '@lib/cameraPrefs';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { FramePicker } from '@/components/molecules/FramePicker';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Mono size={typeScale.caption} color={colors.paper60} style={styles.sectionTitle}>
        {title}
      </Mono>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange, disabled }: { label: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={[styles.row, disabled ? styles.rowDisabled : null]}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.ink2, true: colors.safelight }}
        thumbColor={colors.paper}
        ios_backgroundColor={colors.ink2}
      />
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

type RowProps = { label: string; value?: string; soon?: boolean; danger?: boolean; chevron?: boolean; onPress?: () => void };

function Row({ label, value, soon, danger, chevron, onPress }: RowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.rowPressed : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={[styles.rowLabel, danger && styles.rowDanger]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {soon ? (
          <View style={styles.soonTag}>
            <Mono size={10} color={colors.paper60}>
              SOON
            </Mono>
          </View>
        ) : null}
        {chevron ? <ChevronRight size={18} strokeWidth={icons.strokeWidth} color={colors.paper40} /> : null}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data, refresh } = useProfile(null);
  const [showFrames, setShowFrames] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAdmin = useIsAdmin();

  // Analytics consent toggle — reads the real PostHog opt-in state on mount.
  const [analyticsOn, setAnalyticsOn] = useState(() => getConsentSync());
  const toggleAnalytics = useCallback(async () => {
    const next = !analyticsOn;
    setAnalyticsOn(next);
    await setConsent(next);
  }, [analyticsOn]);

  // What every user sees: a clean, standard version string — "1.0.0 (6)" — where
  // the parenthetical is the store build number (versionCode). No dev jargon.
  const semver = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber = Application.nativeBuildVersion; // "6" on Android, null in dev/web
  const version = buildNumber ? `${semver} (${buildNumber})` : semver;

  // OTA canary — dev-facing, so only admins see it. The same signal is also in
  // PostHog as `ota_update_id`, so hiding it here loses no visibility.
  const otaBuild = Updates.isEmbeddedLaunch ? 'base' : (Updates.updateId?.slice(0, 8) ?? 'ota');

  // Contact opens the mail app pre-addressed to support. Subject is tagged with the
  // app version so replies arrive with the context we'd otherwise have to ask for.
  const contact = useCallback(() =>
    void Linking.openURL(`mailto:hello@joinpiqa.com?subject=${encodeURIComponent(`Piqa support (v${version})`)}`),
  [version]);

  // Reflect the real OS notification permission, re-read on focus so it updates
  // after the user flips it in system settings and returns. (Delivery itself lights
  // up once push tokens register — see lib/push.ts — but the permission and this
  // control are real today, so the row is never a "coming soon" stub.)
  const [notifOn, setNotifOn] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Notifications.getPermissionsAsync().then((p) => {
        if (alive) setNotifOn(p.granted);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  // Per-category notification preferences (disabled visually when the OS permission
  // is off — there's nothing to receive until that's granted).
  const { prefs, toggle } = useNotifPrefs();
  const prefsDisabled = notifOn === false;

  // Equipping only changes the profile frame (the avatar ring). Move the checkmark
  // optimistically so it's instant, then refresh the profile (stale-while-revalidate,
  // so the list never flashes to a loading state). Revert the optimistic pick on failure.
  const [pendingEquip, setPendingEquip] = useState<FrameId | null>(null);
  const onEquip = useCallback(async (id: FrameId) => {
    setPendingEquip(id);
    setEquipping(true);
    const ok = await equipFrame(id);
    setEquipping(false);
    if (ok) await refresh();
    else setPendingEquip(null);
  }, [refresh]);
  const onDelete = useCallback(async () => {
    setBusy(true);
    const ok = await deleteAccount();
    setBusy(false);
    if (ok) {
      setConfirmDelete(false);
      await supabase.auth.signOut(); // session is now invalid → back to auth
    }
  }, []);

  // Data export (Play/GDPR): gather everything the user owns into a JSON file and
  // open the share sheet. Label flips to "Preparing…" while the RPC + file write run.
  const [exporting, setExporting] = useState(false);
  const onExport = useCallback(async () => {
    setExporting(true);
    const ok = await exportMyData();
    setExporting(false);
    if (!ok) Alert.alert("Couldn't export your data", 'Something went wrong. Please try again.');
  }, []);

  // Local-only camera preferences — the camera screen reads them fresh on each open.
  const [gridEnabled, setGridEnabledState] = useState(() => getGridEnabledSync());
  const toggleGrid = useCallback(async () => {
    const next = !gridEnabled;
    setGridEnabledState(next);
    await setGridEnabled(next);
  }, [gridEnabled]);
  const [mirrorEnabled, setMirrorEnabledState] = useState(() => getMirrorEnabledSync());
  const toggleMirror = useCallback(async () => {
    const next = !mirrorEnabled;
    setMirrorEnabledState(next);
    await setMirrorEnabled(next);
  }, [mirrorEnabled]);

  // Local-only preference — the capture queue reads it directly, no server round trip.
  const [wifiOnly, setWifiOnlyState] = useState(() => getWifiOnlySync());
  const toggleWifiOnly = useCallback(async () => {
    const next = !wifiOnly;
    setWifiOnlyState(next);
    await setWifiOnly(next);
    wakeCaptureQueue();
  }, [wifiOnly]);

  // Re-read on focus so it reflects captures uploaded since the last visit.
  const [cacheSize, setCacheSize] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setCacheSize(getCacheSize());
    }, []),
  );
  const [clearingCache, setClearingCache] = useState(false);
  const onClearCache = useCallback(async () => {
    setClearingCache(true);
    await clearCache();
    setCacheSize(getCacheSize());
    setClearingCache(false);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        {isAdmin ? (
          <Section title="ADMIN">
            <Row label={S.settingsAdmin} chevron onPress={() => router.push('/admin')} />
          </Section>
        ) : null}

        <Section title="PROFILE">
          <Row label="Edit profile" chevron onPress={() => router.push('/edit-profile')} />
          <View style={styles.divider} />
          <Row label="Profile frame" chevron onPress={() => setShowFrames(true)} />
        </Section>

        <Section title="CAMERA & CAPTURE">
          <ToggleRow label="Grid overlay" value={gridEnabled} onValueChange={() => void toggleGrid()} />
          <View style={styles.divider} />
          <ToggleRow label="Mirror front camera" value={mirrorEnabled} onValueChange={() => void toggleMirror()} />
        </Section>

        <Section title="NOTIFICATIONS">
          {prefs && (
            <>
              <ToggleRow label="New Subject" value={prefs.daily} disabled={prefsDisabled} onValueChange={() => toggle('daily')} />
              <ToggleRow label="Results" value={prefs.results} disabled={prefsDisabled} onValueChange={() => toggle('results')} />
              <ToggleRow label="Your photo did well" value={prefs.wins} disabled={prefsDisabled} onValueChange={() => toggle('wins')} />
              <ToggleRow label="Appreciation" value={prefs.appreciation} disabled={prefsDisabled} onValueChange={() => toggle('appreciation')} />
              <ToggleRow label="New follower" value={prefs.social} disabled={prefsDisabled} onValueChange={() => toggle('social')} />
              <ToggleRow label="Closing soon (if you haven't shot today)" value={prefs.closingSoon} disabled={prefsDisabled} onValueChange={() => toggle('closingSoon')} />
              <ToggleRow label="Weekly recap (Sunday mornings)" value={prefs.weeklyRecap} disabled={prefsDisabled} onValueChange={() => toggle('weeklyRecap')} />
              <ToggleRow label="Quiet hours (9PM–8AM)" value={prefs.quiet} disabled={prefsDisabled} onValueChange={() => toggle('quiet')} />
            </>
          )}
          <Row
            label="System permission"
            value={notifOn === null ? undefined : notifOn ? 'On' : 'Off'}
            chevron
            onPress={() => void Linking.openSettings()}
          />
        </Section>

        <Section title="ACCOUNT">
          <Row label="Email" value={session?.user.email ?? '—'} chevron onPress={() => router.push('/change-email')} />
          <View style={styles.divider} />
          <Row label="Change password" chevron onPress={() => router.push('/change-password')} />
          <View style={styles.divider} />
          <Row label="Connected accounts" chevron onPress={() => router.push('/connected-accounts')} />
          <View style={styles.divider} />
          <Row
            label={exporting ? 'Preparing…' : 'Download my data'}
            chevron={!exporting}
            onPress={exporting ? undefined : () => void onExport()}
          />
          <View style={styles.divider} />
          <Row label="Sign out" onPress={() => setConfirmSignOut(true)} />
        </Section>

        <Section title="DATA & STORAGE">
          <ToggleRow label="Upload over Wi-Fi only" value={wifiOnly} onValueChange={() => void toggleWifiOnly()} />
          <View style={styles.divider} />
          <Row
            label={clearingCache ? 'Clearing…' : 'Clear cache'}
            value={clearingCache ? undefined : formatBytes(cacheSize)}
            onPress={clearingCache ? undefined : () => void onClearCache()}
          />
        </Section>

        <Section title="SAFETY">
          <Row label="Blocked accounts" chevron onPress={() => router.push('/blocked')} />
        </Section>

        <Section title="ABOUT">
          <ToggleRow label="Analytics" value={analyticsOn} onValueChange={() => void toggleAnalytics()} />
          <View style={styles.divider} />
          <Row label="Version" value={version} />
          {isAdmin ? (
            <>
              <View style={styles.divider} />
              <Row label="Build" value={otaBuild} />
            </>
          ) : null}
          <View style={styles.divider} />
          <Row label="How piqa works" chevron onPress={() => router.push('/help')} />
          <View style={styles.divider} />
          <Row label="Terms of Service" chevron onPress={() => router.push('/legal/terms')} />
          <View style={styles.divider} />
          <Row label="Privacy Policy" chevron onPress={() => router.push('/legal/privacy')} />
          <View style={styles.divider} />
          <Row label="Contact" chevron onPress={contact} />
        </Section>

        <Section title="DANGER ZONE">
          <Row label="Delete account" danger onPress={() => setConfirmDelete(true)} />
        </Section>
      </ScrollView>

      <Sheet visible={showFrames} onClose={() => setShowFrames(false)} title="Profile frame">
        <FramePicker
          equipped={pendingEquip ?? data?.equippedFrame ?? 'default'}
          owned={data?.ownedFrames ?? []}
          avatarUri={data?.avatarUrl}
          username={data?.username ?? ''}
          level={levelProgress(data?.xp ?? 0).level}
          busy={equipping}
          onEquip={(id) => void onEquip(id)}
        />
      </Sheet>

      <Sheet visible={confirmSignOut} onClose={() => setConfirmSignOut(false)} title="Sign out?">
        <Text style={styles.warn}>You can sign back in anytime.</Text>
        <Button label="Sign out" variant="primary" fullWidth onPress={() => void supabase.auth.signOut()} />
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConfirmSignOut(false)} />
        <View style={styles.pad} />
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete account?">
        <Text style={styles.warn}>
          This permanently deletes your account, every shot, and all your stats. It cannot be undone.
        </Text>
        <Button label="Keep my account" variant="primary" fullWidth onPress={() => setConfirmDelete(false)} />
        <Pressable accessibilityRole="button" style={styles.deleteRow} disabled={busy} onPress={() => void onDelete()}>
          <Text style={styles.deleteText}>{busy ? 'Deleting…' : 'Delete forever'}</Text>
        </Pressable>
        <View style={styles.pad} />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 48, gap: space.lgPlus },
  section: { gap: 8 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: 4 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  row: {
    minHeight: space.target,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: space.smPlus,
  },
  rowPressed: { backgroundColor: colors.ink },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper, flexShrink: 1 },
  rowDanger: { color: colors.heart },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  rowValue: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, flexShrink: 1 },
  soonTag: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
    paddingVertical: space.xxs,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginLeft: space.smPlus },
  warn: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center' },
  deleteRow: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.heart },
  pad: { height: 4 },
});
