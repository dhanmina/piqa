import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchRecapPhotos } from '../lib/captureQueries';
import { createRecapShare, recapShareUrl } from '../lib/recapShares';
import { RecapSlideshow } from '../components/RecapSlideshow';
import { Screen } from '../components/Screen';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

export default function Recap() {
  const { range } = useLocalSearchParams<{ range?: string }>();
  const isYear = range === 'year';
  const kind = isYear ? 'year' : 'week';
  const { data: photos = [], isLoading } = useQuery({
    queryKey: queryKeys.recap(kind),
    queryFn: () => fetchRecapPhotos(kind),
    // Opened deliberately and rarely (not a background tab) -- unlike
    // timeline/today, nothing invalidates this key when a new capture lands,
    // so it must refetch every time it's opened rather than trust the
    // Infinity default in queryClient.ts.
    staleTime: 0,
  });

  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    const { data, error } = await createRecapShare(kind);
    setSharing(false);
    if (error || !data) {
      Alert.alert('Could not create link', 'Try again in a moment.');
      return;
    }
    Share.share({ message: recapShareUrl(data.id) });
  }

  const header = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ ...type.title, color: colors.textPrimary }}>{isYear ? 'Your year' : 'Your week'}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {photos.length > 0 && (
          <Pressable
            hitSlop={touchTarget.min}
            disabled={sharing}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share this recap"
            style={{
              width: touchTarget.min,
              height: touchTarget.min,
              borderRadius: radius.button,
              backgroundColor: colors.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sharing ? 0.5 : 1,
            }}
          >
            <Text style={{ ...type.body, color: colors.textPrimary }}>Share</Text>
          </Pressable>
        )}
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
    </View>
  );

  if (photos.length === 0) {
    return (
      <Screen style={{ gap: spacing.md }}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {isLoading ? (
            <ActivityIndicator color={colors.textMuted} />
          ) : (
            <Text style={{ ...type.body, color: colors.textMuted }}>
              {isYear ? 'No captures yet this year.' : 'No captures yet this week.'}
            </Text>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={{ gap: spacing.md }}>
      <RecapSlideshow photos={photos} kind={kind}>
        {header}
      </RecapSlideshow>
    </Screen>
  );
}
