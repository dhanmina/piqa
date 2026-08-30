import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { signOut } from '../../lib/auth';
import { fetchProfile, fetchStats, fetchArchiveMosaic, type ProfileInfo, type Stats } from '../../lib/profile';
import { MosaicGrid, type MosaicPhoto } from '../../components/MosaicGrid';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Divider } from '../../components/Divider';
import { Screen } from '../../components/Screen';
import { TextLink } from '../../components/TextLink';
import { Avatar } from '../../components/Avatar';
import { colors, spacing, type } from '../../lib/theme';

const MOSAIC_CAP = 27;

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  console.error('[profile] render crashed', error);
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
          Couldn't load your profile.
        </Text>
        <TextLink label="Try again" onPress={retry} accessibilityLabel="Retry loading profile" />
      </View>
    </Screen>
  );
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function tenureLabel(createdAt: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const since = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `Capturing since ${since}`;
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
      ? photos.length === MOSAIC_CAP
        ? `Your archive · latest ${MOSAIC_CAP} photos`
        : `Your archive · ${photos.length} ${pluralize(photos.length, 'photo')}`
      : 'Your archive';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar url={profileInfo?.avatar_url} name={profileInfo?.display_name} accessibilityLabel="Your profile photo" />
          <View style={{ gap: spacing.xxs, flexShrink: 1 }}>
            <Text style={{ ...type.title, color: colors.textPrimary }} numberOfLines={1}>
              {profileLoading ? ' ' : (profileInfo?.display_name ?? 'Your profile')}
            </Text>
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              {profileError
                ? "Couldn't load profile."
                : !profileLoading && profileInfo
                  ? (tenureLabel(profileInfo.created_at) ?? ' ')
                  : ' '}
            </Text>
          </View>
          <TextLink
            label="Edit"
            inline
            accessibilityLabel="Edit profile"
            onPress={() =>
              router.push({ pathname: '/edit-profile', params: { displayName: profileInfo?.display_name ?? '' } })
            }
          />
        </View>

        <Card>
          {statsError ? (
            <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>
              Couldn't load your stats. Check your connection and try again.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View
                style={{ gap: spacing.xxs }}
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
              <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
              <View
                style={{ gap: spacing.xxs, alignItems: 'flex-end' }}
                accessible
                accessibilityLabel={
                  statsLoading
                    ? 'Longest streak loading'
                    : `Longest streak: ${stats?.longest_count ?? 0} ${pluralize(stats?.longest_count ?? 0, 'day')}`
                }
              >
                <Text style={{ ...type.title, color: colors.textPrimary }}>
                  {statsLoading ? '…' : (stats?.longest_count ?? 0)}
                </Text>
                <Text style={{ ...type.caption, color: colors.textMuted }}>
                  Longest {pluralize(stats?.longest_count ?? 0, 'day')}
                </Text>
              </View>
            </View>
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
              <TextLink
                label="See full archive"
                accessibilityLabel="See full archive in Timeline"
                onPress={() => router.push('/(tabs)/timeline')}
              />
            </>
          ) : (
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Nothing captured yet. Your archive starts with your first photo.
            </Text>
          )}
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

      <PhotoViewerModal url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </Screen>
  );
}
