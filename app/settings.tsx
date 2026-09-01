import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/captureQueries';
import { signOut } from '../lib/auth';
import { fetchAccountInfo, type AccountInfo } from '../lib/settings';
import { fetchProfile, type ProfileInfo } from '../lib/profile';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Divider } from '../components/Divider';
import { TextLink } from '../components/TextLink';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { colors, spacing, touchTarget, type } from '../lib/theme';

const BACK_ICON = { ios: 'chevron.left', android: 'arrow_back' } as const;

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

export default function Settings() {
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

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
          <SymbolView name={BACK_ICON} size={22} tintColor={colors.textPrimary} />
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
      </ScrollView>
    </Screen>
  );
}
