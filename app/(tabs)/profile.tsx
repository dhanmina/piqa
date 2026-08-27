import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { MosaicGrid, type MosaicPhoto } from '../../components/MosaicGrid';
import { PhotoViewerModal } from '../../components/PhotoViewerModal';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Divider } from '../../components/Divider';
import { Screen } from '../../components/Screen';
import { colors, height, spacing, touchTarget, type } from '../../lib/theme';

type Stats = { current_count: number; longest_count: number };
type ProfileInfo = { display_name: string | null; avatar_url: string | null; created_at: string };

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
  if (url) return <Image source={{ uri: url }} style={baseStyle} />;
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('get_profile_mosaic').then(async ({ data }) => {
      const rows: { storage_path: string; captured_at: string }[] = data ?? [];
      if (rows.length === 0) {
        setPhotosLoading(false);
        return;
      }
      const paths = rows.map((r) => r.storage_path);
      const { data: signed } = await supabase.storage.from('captures').createSignedUrls(paths, 3600);
      const urlByPath = new Map<string, string>();
      signed?.forEach((s) => {
        if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
      });
      const mosaic: MosaicPhoto[] = rows
        .map((r) => ({ url: urlByPath.get(r.storage_path), capturedAt: r.captured_at }))
        .filter((p): p is MosaicPhoto => !!p.url);
      setPhotos(mosaic);
      setPhotosLoading(false);
    });

    supabase.rpc('get_today_state').then(({ data }) => {
      setStats(data?.[0] ?? null);
      setStatsLoading(false);
    });

    supabase
      .from('profiles')
      .select('display_name, avatar_url, created_at')
      .single()
      .then(({ data }) => {
        setProfileInfo(data ?? null);
        setProfileLoading(false);
      });
  }, []);

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
    !photosLoading && photos.length > 0
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
              {!profileLoading && profileInfo ? tenureLabel(profileInfo.created_at) : ' '}
            </Text>
          </View>
        </View>

        <Card style={{ flexDirection: 'row', gap: spacing.lg }}>
          <View style={{ gap: spacing.xxs }}>
            <Text style={{ ...type.hero, color: colors.textPrimary }}>
              {statsLoading ? '…' : (stats?.current_count ?? 0)}
            </Text>
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Current {pluralize(stats?.current_count ?? 0, 'day')}
            </Text>
          </View>
          <View style={{ gap: spacing.xxs }}>
            <Text style={{ ...type.hero, color: colors.textPrimary }}>
              {statsLoading ? '…' : (stats?.longest_count ?? 0)}
            </Text>
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Longest {pluralize(stats?.longest_count ?? 0, 'day')}
            </Text>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...type.body, color: colors.textMuted }}>{archiveLabel}</Text>
          {photosLoading ? null : photos.length > 0 ? (
            <MosaicGrid photos={photos} onPressPhoto={(p) => setViewerUrl(p.url)} />
          ) : (
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Nothing captured yet. Your archive starts with your first photo.
            </Text>
          )}
        </View>

        <Button label="View your year" onPress={() => router.push('/recap?range=year')} />

        <Divider />

        <Pressable
          onPress={confirmSignOut}
          disabled={signingOut}
          accessibilityRole="button"
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
