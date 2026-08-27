import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { signOut } from '../../lib/auth';
import { MosaicGrid } from '../../components/MosaicGrid';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { colors, spacing, type } from '../../lib/theme';

type Stats = { current_count: number; longest_count: number };

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

export default function Profile() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.rpc('get_profile_mosaic').then(async ({ data }) => {
      const paths: string[] = (data ?? []).map((r: any) => r.storage_path);
      if (paths.length === 0) return;
      const { data: signed } = await supabase.storage.from('captures').createSignedUrls(paths, 3600);
      setPhotos((signed ?? []).map((s) => s.signedUrl).filter((url): url is string => !!url));
    });
    supabase.rpc('get_today_state').then(({ data }) => setStats(data?.[0] ?? null));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    // No navigation call needed — RootLayout's onAuthStateChange listener
    // flips `signedIn` and Stack.Protected swaps the active route group.
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Profile</Text>

        <Card style={{ flexDirection: 'row', gap: spacing.lg }}>
          <View style={{ gap: spacing.xxs }}>
            <Text style={{ ...type.hero, color: colors.textPrimary }}>{stats?.current_count ?? 0}</Text>
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Current {pluralize(stats?.current_count ?? 0, 'day')}
            </Text>
          </View>
          <View style={{ gap: spacing.xxs }}>
            <Text style={{ ...type.hero, color: colors.textPrimary }}>{stats?.longest_count ?? 0}</Text>
            <Text style={{ ...type.caption, color: colors.textMuted }}>
              Longest {pluralize(stats?.longest_count ?? 0, 'day')}
            </Text>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ ...type.body, color: colors.textMuted }}>Your archive</Text>
          {photos.length > 0 ? (
            <MosaicGrid photos={photos} />
          ) : (
            <Text style={{ ...type.caption, color: colors.textMuted }}>Nothing captured yet.</Text>
          )}
        </View>

        <Button
          label="Sign out"
          loadingLabel="Signing out..."
          variant="secondary"
          loading={signingOut}
          onPress={handleSignOut}
        />
      </ScrollView>
    </Screen>
  );
}
