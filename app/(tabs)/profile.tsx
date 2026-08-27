import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect } from 'expo-router';
import { signOut } from '../../lib/auth';
import { fetchProfile, fetchStats, fetchArchiveMosaic, type ProfileInfo, type Stats } from '../../lib/profile';
import { MosaicGrid, type MosaicPhoto } from '../../components/MosaicGrid';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Divider } from '../../components/Divider';
import { Screen } from '../../components/Screen';
import { colors, height, spacing, touchTarget, type } from '../../lib/theme';

const PERSON_ICON = { ios: 'person.fill', android: 'person' } as const;

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function tenureLabel(createdAt: string): string {
  const since = new Date(createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `Capturing since ${since}`;
}

function Avatar({ url, name }: { url: string | null | undefined; name: string | null | undefined }) {
  const size = height.control;
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };
  if (url) return <Image source={{ uri: url }} style={baseStyle} accessibilityLabel="Your profile photo" />;
  const initial = name?.trim()?.[0]?.toUpperCase();
  return (
    <View style={baseStyle}>
      {initial ? (
        <Text style={{ ...type.title, color: colors.textPrimary }}>{initial}</Text>
      ) : (
        <SymbolView name={PERSON_ICON} size={22} tintColor={colors.textMuted} />
      )}
    </View>
  );
}

export default function Profile() {
  const [photos, setPhotos] = useState<MosaicPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const { data, error } = await fetchProfile();
    setProfileError(!!error);
    if (!error) setProfileInfo(data);
    setProfileLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    const { data, error } = await fetchStats();
    setStatsError(!!error);
    if (!error) setStats(data);
    setStatsLoading(false);
  }, []);

  const loadArchive = useCallback(async () => {
    const { data, error } = await fetchArchiveMosaic();
    setPhotosError(!!error);
    if (!error) setPhotos(data);
    setPhotosLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadStats();
      loadArchive();
    }, [loadProfile, loadStats, loadArchive])
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

  const archiveLabel =
    !photosLoading && !photosError && photos.length > 0
      ? `Your archive · ${photos.length} ${pluralize(photos.length, 'photo')}`
      : 'Your archive';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar url={profileInfo?.avatar_url} name={profileInfo?.display_name} />
          <View style={{ gap: spacing.xxs, flexShrink: 1 }}>
            <Text style={{ ...type.title, color: colors.textPrimary }} numberOfLines={1}>
              {profileLoading ? ' ' : (profileInfo?.display_name ?? 'Your profile')}
            </Text>
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              {profileError
                ? "Couldn't load profile."
                : !profileLoading && profileInfo
                  ? tenureLabel(profileInfo.created_at)
                  : ' '}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/edit-profile', params: { displayName: profileInfo?.display_name ?? '' } })
            }
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={{
              minHeight: touchTarget.min,
              paddingHorizontal: spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ ...type.caption, color: colors.textPrimary, fontWeight: '600' }}>Edit</Text>
          </Pressable>
        </View>

        <Card style={{ flexDirection: 'row', gap: spacing.lg }}>
          {statsError ? (
            <Text style={{ ...type.caption, color: colors.textMuted, flex: 1, textAlign: 'center' }}>
              Couldn't load your stats. Check your connection and try again.
            </Text>
          ) : (
            <>
              <View
                style={{ flex: 1, gap: spacing.xxs }}
                accessible
                accessibilityLabel={
                  statsLoading
                    ? 'Current streak loading'
                    : `Current streak: ${stats?.current_count ?? 0} ${pluralize(stats?.current_count ?? 0, 'day')}`
                }
              >
                <Text style={{ ...type.hero, color: colors.textPrimary }}>
                  {statsLoading ? '…' : (stats?.current_count ?? 0)}
                </Text>
                <Text style={{ ...type.caption, color: colors.textMuted }}>
                  Current {pluralize(stats?.current_count ?? 0, 'day')}
                </Text>
              </View>
              <View
                style={{ flex: 1, gap: spacing.xxs }}
                accessible
                accessibilityLabel={
                  statsLoading
                    ? 'Longest streak loading'
                    : `Longest streak: ${stats?.longest_count ?? 0} ${pluralize(stats?.longest_count ?? 0, 'day')}`
                }
              >
                <Text style={{ ...type.hero, color: colors.textPrimary }}>
                  {statsLoading ? '…' : (stats?.longest_count ?? 0)}
                </Text>
                <Text style={{ ...type.caption, color: colors.textMuted }}>
                  Longest {pluralize(stats?.longest_count ?? 0, 'day')}
                </Text>
              </View>
            </>
          )}
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...type.body, color: colors.textMuted }}>{archiveLabel}</Text>
          {photosLoading ? null : photosError ? (
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Couldn't load your archive. Check your connection and try again.
            </Text>
          ) : photos.length > 0 ? (
            <>
              <MosaicGrid photos={photos} onPressPhoto={(p) => setViewerUrl(p.url)} />
              <Pressable
                onPress={() => router.push('/(tabs)/timeline')}
                accessibilityRole="button"
                accessibilityLabel="See full archive in Timeline"
                style={{
                  alignSelf: 'center',
                  minHeight: touchTarget.min,
                  paddingHorizontal: spacing.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ ...type.caption, color: colors.textPrimary, fontWeight: '600' }}>
                  See full archive
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Nothing captured yet. Your archive starts with your first photo.
            </Text>
          )}
        </View>

        <Button label="View your year" variant="secondary" onPress={() => router.push('/recap?range=year')} />

        <Divider />

        <Pressable
          onPress={confirmSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel={signingOut ? 'Signing out' : 'Sign out'}
          accessibilityState={{ disabled: signingOut }}
          style={{
            alignSelf: 'center',
            minHeight: touchTarget.min,
            paddingHorizontal: spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...type.body, color: colors.textMuted }}>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </Text>
        </Pressable>
      </ScrollView>

      <PhotoViewerModal url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </Screen>
  );
}
