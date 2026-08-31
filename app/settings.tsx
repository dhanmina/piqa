import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { signOut } from '../lib/auth';
import { fetchAccountInfo, type AccountInfo } from '../lib/settings';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { Divider } from '../components/Divider';
import { TextLink } from '../components/TextLink';
import { colors, spacing, touchTarget, type } from '../lib/theme';

const BACK_ICON = { ios: 'chevron.left', android: 'arrow_back' } as const;

export default function Settings() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [accountError, setAccountError] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadAccount = useCallback(async () => {
    const { data, error } = await fetchAccountInfo();
    setAccountError(!!error);
    if (!error) setAccount(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccount();
    }, [loadAccount])
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
