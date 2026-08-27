import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { RecapSlideshow } from '../components/RecapSlideshow';
import { Screen } from '../components/Screen';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

export default function Recap() {
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    supabase.rpc('get_weekly_recap').then(async ({ data }) => {
      const paths: string[] = (data ?? []).map((r: any) => r.storage_path);
      if (paths.length === 0) return;
      const { data: signed } = await supabase.storage.from('captures').createSignedUrls(paths, 3600);
      setPhotos((signed ?? []).map((s) => s.signedUrl).filter((url): url is string => !!url));
    });
  }, []);

  return (
    <Screen style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>Your week</Text>
        <Pressable
          hitSlop={touchTarget.min}
          onPress={() => router.back()}
          style={{
            width: touchTarget.min,
            height: touchTarget.min,
            borderRadius: radius.button,
            backgroundColor: colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...type.title, color: colors.textPrimary }}>✕</Text>
        </Pressable>
      </View>
      {photos.length > 0 ? (
        <RecapSlideshow photos={photos} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...type.body, color: colors.textMuted }}>No captures yet this week.</Text>
        </View>
      )}
    </Screen>
  );
}
