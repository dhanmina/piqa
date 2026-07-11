// Placeholder — the wins wall + cosmetics ship in Phase 4. Sign out lives
// here already so testers can switch accounts.
import { User } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@lib/supabase';
import { EmptyState } from '@/components/molecules/EmptyState';
import { colors } from '@/components/tokens';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.center}>
        <EmptyState
          icon={User}
          line="Your first gallery win starts the wall"
          ctaLabel="Sign out"
          onCta={() => void supabase.auth.signOut()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, justifyContent: 'center' },
});
