/**
 * Gallery (Phase 2 subset) — never blank. Shows the most recent revealed
 * gallery, or the seed house-account gallery as a fallback with "The first
 * galleries are rolling in." Full World/Following + past galleries land in Phase 3.
 */
import { Image as ImageIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLatestGallery } from '@lib/gallery';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { EmptyState } from '@/components/molecules/EmptyState';
import { GalleryGrid } from '@/components/molecules/GalleryGrid';
import { colors, fonts, space, typeScale } from '@/components/tokens';

export default function GalleryScreen() {
  const { data, loading } = useLatestGallery();

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  if (!data?.drop || data.photos.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <EmptyState icon={ImageIcon} line="The first galleries are rolling in." />
        </View>
      </SafeAreaView>
    );
  }

  const dateLine = new Date(data.drop.drop_date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Mono size={typeScale.caption} color={colors.paper60}>
            {dateLine}
          </Mono>
          {data.drop.prompt && <Text style={styles.prompt}>{data.drop.prompt}</Text>}
          {data.isSeed && <Text style={styles.rollingIn}>The first galleries are rolling in.</Text>}
        </View>
        <GalleryGrid photos={data.photos} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: space.gutter,
    gap: space.gutter,
  },
  header: {
    gap: 6,
  },
  prompt: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
  },
  rollingIn: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  skeleton: {
    flex: 1,
    margin: space.gutter,
    borderRadius: 12,
    backgroundColor: colors.ink2,
  },
});
