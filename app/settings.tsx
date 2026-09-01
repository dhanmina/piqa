import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/captureQueries';
import { signOut } from '../lib/auth';
import { fetchAccountInfo, deleteOwnAccount, type AccountInfo } from '../lib/settings';
import { fetchProfile, type ProfileInfo } from '../lib/profile';
import {
  getNotificationPermission,
  getReminderPrefs,
  requestNotificationPermission,
  setReminderEnabled,
  setReminderTime,
  REMINDER_TIME_PRESETS,
  type ReminderTime,
  type PermissionState,
} from '../lib/reminder';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Divider } from '../components/Divider';
import { TextLink } from '../components/TextLink';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { SelectableRow } from '../components/SelectableRow';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BackIcon } from '../components/Icons';
import { colors, spacing, touchTarget, type } from '../lib/theme';

async function loadAccountOrThrow(): Promise<AccountInfo | null> {
  const { data, error } = await fetchAccountInfo();
  if (error) throw error;
  return data;
}

async function loadProfileOrThrow(): Promise<ProfileInfo | null> {
  const { data, error } = await fetchProfile();
  if (error) throw error;
  return data;
}

function sameTime(a: ReminderTime, b: ReminderTime): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const [notifPermission, setNotifPermission] = useState<PermissionState | null>(null);
  const [reminderEnabled, setReminderEnabledState] = useState(false);
  const [reminderTime, setReminderTimeState] = useState<ReminderTime>(REMINDER_TIME_PRESETS[2].time);
  const [reminderBusy, setReminderBusy] = useState(false);

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Persisted cache (app/_layout.tsx) paints last-known account/profile immediately on
  // reopen instead of blanking the screen every time -- see the same fix in buddies.tsx.
  const accountQuery = useQuery({ queryKey: queryKeys.accountInfo, queryFn: loadAccountOrThrow });
  const profileQuery = useQuery({ queryKey: queryKeys.profileInfo, queryFn: loadProfileOrThrow });
  const account = accountQuery.data ?? null;
  const accountError = accountQuery.isError;
  const profileInfo = profileQuery.data ?? null;
  const profileLoading = profileQuery.isLoading;

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accountInfo });
      queryClient.invalidateQueries({ queryKey: queryKeys.profileInfo });

      // Permission can change from outside the app (system settings), and
      // onboarding can enable the reminder just before landing here for the
      // first time -- both re-read on every visit, not just on mount.
      (async () => {
        const [permission, prefs] = await Promise.all([getNotificationPermission(), getReminderPrefs()]);
        setNotifPermission(permission);
        setReminderEnabledState(prefs.enabled);
        setReminderTimeState(prefs.time);
      })();
    }, [queryClient])
  );

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await signOut();
    if (error) {
      setSigningOut(false);
      Alert.alert('Could not sign out', 'Check your connection and try again.');
      return;
    }
    // No navigation call needed on success — RootLayout's onAuthStateChange
    // listener flips `signedIn` and Stack.Protected swaps the active route group.
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You can sign back in any time. Nothing is deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  }

  async function handleToggleReminder(next: boolean) {
    let permission = notifPermission;
    if (next && permission !== 'granted') {
      permission = await requestNotificationPermission();
      setNotifPermission(permission);
      if (permission !== 'granted') return;
    }
    setReminderEnabledState(next);
    setReminderBusy(true);
    try {
      await setReminderEnabled(next, reminderTime);
    } catch {
      setReminderEnabledState(!next);
    }
    setReminderBusy(false);
  }

  async function handleSelectTime(time: ReminderTime) {
    setReminderTimeState(time);
    await setReminderTime(time);
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    const { error } = await deleteOwnAccount();
    if (error) {
      setDeletingAccount(false);
      setConfirmDeleteVisible(false);
      Alert.alert('Could not delete account', 'Check your connection and try again.');
      return;
    }
    await signOut();
    // No navigation call needed — same RootLayout auth-state redirect as sign-out.
  }

  return (
    <Screen style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          hitSlop={touchTarget.min}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <BackIcon size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar
            url={profileInfo?.avatar_url}
            name={profileInfo?.display_name}
            size={56}
            accessibilityLabel="Your profile photo"
          />
          <View style={{ gap: spacing.xxs, flexShrink: 1 }}>
            <Text style={{ ...type.bodyBold, color: colors.textPrimary }} numberOfLines={1}>
              {profileLoading ? ' ' : (profileInfo?.display_name ?? 'Your profile')}
            </Text>
            <TextLink
              label="Edit profile"
              inline
              accessibilityLabel="Edit profile"
              onPress={() =>
                router.push({
                  pathname: '/edit-profile',
                  params: { displayName: profileInfo?.display_name ?? '', avatarUrl: profileInfo?.avatar_url ?? '' },
                })
              }
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...type.body, color: colors.textMuted }}>Reminders</Text>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: spacing.xxs, marginRight: spacing.md }}>
                <Text style={{ ...type.bodyBold, color: colors.textPrimary }}>Daily reminder</Text>
                <Text style={{ ...type.caption, color: colors.textMuted }}>
                  One nudge a day if you haven't captured yet.
                </Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={handleToggleReminder}
                disabled={reminderBusy || notifPermission === 'denied'}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textPrimary}
                accessibilityLabel="Daily reminder"
                accessibilityState={{ disabled: reminderBusy || notifPermission === 'denied' }}
              />
            </View>

            {notifPermission === 'denied' && (
              <>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...type.caption, color: colors.textMuted, flex: 1, marginRight: spacing.md }}>
                    Notifications are off in system settings.
                  </Text>
                  <TextLink
                    label="Turn on"
                    inline
                    accessibilityLabel="Open system notification settings"
                    onPress={() => Linking.openSettings()}
                  />
                </View>
              </>
            )}

            {reminderEnabled && notifPermission !== 'denied' && (
              <>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {REMINDER_TIME_PRESETS.map((preset) => (
                    <SelectableRow
                      key={preset.label}
                      label={preset.label}
                      selected={sameTime(preset.time, reminderTime)}
                      onPress={() => handleSelectTime(preset.time)}
                    />
                  ))}
                </View>
              </>
            )}
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...type.body, color: colors.textMuted }}>Account</Text>
          <Card style={{ gap: spacing.md }}>
            {accountError ? (
              <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
                Couldn't load account details. Check your connection and try again.
              </Text>
            ) : (
              <>
                <View style={{ gap: spacing.xxs }}>
                  <Text style={{ ...type.caption, color: colors.textMuted }}>Email</Text>
                  <Text style={{ ...type.body, color: colors.textPrimary }}>{account?.email ?? ' '}</Text>
                </View>
                {account?.canChangePassword && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                    <TextLink
                      label="Change password"
                      accessibilityLabel="Change password"
                      onPress={() => router.push('/change-password')}
                    />
                  </>
                )}
              </>
            )}
          </Card>
        </View>

        <Button label="View your year" variant="secondary" onPress={() => router.push('/recap?range=year')} />

        <Divider />

        <TextLink
          label={signingOut ? 'Signing out...' : 'Sign out'}
          variant="muted"
          disabled={signingOut}
          accessibilityLabel={signingOut ? 'Signing out' : 'Sign out'}
          onPress={confirmSignOut}
        />

        <View style={{ gap: spacing.xxs }}>
          <TextLink
            label="Delete account"
            variant="muted"
            disabled={deletingAccount}
            accessibilityLabel="Delete account"
            onPress={() => setConfirmDeleteVisible(true)}
          />
          <Text style={{ ...type.caption, color: colors.textFaint, textAlign: 'center' }}>
            Permanently removes your account, photos, and streak. This can't be undone.
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="Delete your account?"
        message="Every photo, your streak, and your profile are permanently removed. This cannot be undone."
        confirmLabel="Delete account"
        confirmLoadingLabel="Deleting..."
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDeleteVisible(false)}
        loading={deletingAccount}
      />
    </Screen>
  );
}
