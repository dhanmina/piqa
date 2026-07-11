/**
 * Curating — placeholder. The blind head-to-head voting screen (get-matchup
 * sets of 10, tap-to-pick) is built in Phase 3. Framed as anticipation, never
 * a dead end: the door is open, the room is being built.
 */
import { useRouter } from 'expo-router';
import { Aperture } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/molecules/EmptyState';
import { colors } from '@/components/tokens';

export default function VoteScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <EmptyState
          icon={Aperture}
          line="Curating opens with the next update — your picks will shape the gallery"
          ctaLabel="Back to Today"
          onCta={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, justifyContent: 'center' },
});
