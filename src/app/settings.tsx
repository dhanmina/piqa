/**
 * /settings — the own-profile control panel, a route (not a sheet) so it has room
 * for grouped sections and back returns to Profile. Order runs top-down by emotional
 * weight: the nice stuff first (customization), the irreversible last (danger zone),
 * so "equip a frame" never sits a tap above "delete account" the way it did in the
 * old flat sheet. The frame picker stays a focused sheet launched from here.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { claimEventFrame, equipFrame, type FrameId } from '@lib/frames';
import { deleteAccount, useProfile } from '@lib/profile';
import { useSession } from '@lib/session';
import { supabase } from '@lib/supabase';
import { Button } from '@/components/atoms/Button';
import { Mono } from '@/components/atoms/Mono';
import { FramePicker } from '@/components/molecules/FramePicker';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Sheet } from '@/components/molecules/Sheet';
import { Toast } from '@/components/molecules/Toast';
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
  const [toast, setToast] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const soon = () => setToast('Coming soon');

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

  // Equipping flips one column; the shared profile cache refresh re-skins the crest
  // and every framed surface.
  const onEquip = async (id: FrameId) => {
    setEquipping(true);
    const ok = await equipFrame(id);
    setEquipping(false);
    if (ok) await refresh();
  };
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
      setConfirmDelete(false);
      await supabase.auth.signOut(); // session is now invalid → back to auth
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader onBack={() => router.back()} title="Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        <Section title="PROFILE">
          <Row label="Edit profile" chevron onPress={() => router.push('/edit-profile')} />
          <View style={styles.divider} />
          <Row label="Frame" chevron onPress={() => setShowFrames(true)} />
        </Section>

        <Section title="NOTIFICATIONS">
          <Row
            label="Push notifications"
            value={notifOn === null ? undefined : notifOn ? 'On' : 'Off'}
            chevron
            onPress={() => void Linking.openSettings()}
          />
        </Section>

        <Section title="ACCOUNT">
          <Row label="Email" value={session?.user.email ?? '—'} />
          <View style={styles.divider} />
          <Row label="Sign out" onPress={() => setConfirmSignOut(true)} />
        </Section>

        <Section title="ABOUT">
          <Row label="Version" value={version} />
          <View style={styles.divider} />
          <Row label="Terms of Service" chevron onPress={soon} />
          <View style={styles.divider} />
          <Row label="Privacy Policy" chevron onPress={soon} />
          <View style={styles.divider} />
          <Row label="Contact" chevron onPress={soon} />
        </Section>

        <Section title="DANGER ZONE">
          <Row label="Delete account" danger onPress={() => setConfirmDelete(true)} />
        </Section>
      </ScrollView>

      <Sheet visible={showFrames} onClose={() => setShowFrames(false)} title="Frame">
        <FramePicker
          equipped={data?.equippedFrame ?? 'default'}
          owned={data?.ownedFrames ?? []}
          previewUri={data?.wins[0]?.uri}
          previewDay={data?.wins[0]?.dayNumber ?? 1}
          busy={equipping}
          onEquip={(id) => void onEquip(id)}
          onClaim={(id) => void onClaim(id)}
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

      <Toast message={toast ?? ''} visible={toast !== null} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.gutter, paddingBottom: 48, gap: 26 },
  section: { gap: 8 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: 4 },
  card: { backgroundColor: colors.ink2, borderRadius: radius.card, overflow: 'hidden' },
  row: {
    minHeight: space.target,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
  },
  rowPressed: { backgroundColor: colors.ink },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper, flexShrink: 1 },
  rowDanger: { color: colors.heart },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  rowValue: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, flexShrink: 1 },
  soonTag: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.paper30, marginLeft: 14 },
  warn: { fontFamily: fonts.sans, fontSize: typeScale.sub, color: colors.paper60, textAlign: 'center' },
  deleteRow: { alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.heart },
  pad: { height: 4 },
});
