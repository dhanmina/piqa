// Placeholder — the month-grouped private journal ships in Phase 4.
import { useRouter } from 'expo-router';
import { BookImage } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/molecules/EmptyState';
import { colors } from '@/components/tokens';

export default function ArchiveScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.center}>
        <EmptyState
          icon={BookImage}
          line="Your journal starts with one shot"
          ctaLabel="Open the camera"
          onCta={() => router.push('/camera')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, justifyContent: 'center' },
});
