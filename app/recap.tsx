import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchRecapPhotos } from '../lib/captureQueries';
import { RecapSlideshow } from '../components/RecapSlideshow';
import { Screen } from '../components/Screen';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';

export default function Recap() {
  const { range } = useLocalSearchParams<{ range?: string }>();
  const isYear = range === 'year';
  const kind = isYear ? 'year' : 'week';
  const { data: photos = [] } = useQuery({
    queryKey: queryKeys.recap(kind),
    queryFn: () => fetchRecapPhotos(kind),
    // Opened deliberately and rarely (not a background tab) -- unlike
    // timeline/today, nothing invalidates this key when a new capture lands,
    // so it must refetch every time it's opened rather than trust the
    // Infinity default in queryClient.ts.
    staleTime: 0,
  });

  return (
    <Screen style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...type.title, color: colors.textPrimary }}>{isYear ? 'Your year' : 'Your week'}</Text>
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
          <Text style={{ ...type.body, color: colors.textMuted }}>
            {isYear ? 'No captures yet this year.' : 'No captures yet this week.'}
          </Text>
        </View>
      )}
    </Screen>
  );
}
