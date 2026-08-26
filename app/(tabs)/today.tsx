import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { PeekBackCard } from '../../components/PeekBackCard';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { colors, spacing, type } from '../../lib/theme';

type TodayState = { current_count: number; longest_count: number; freezes_remaining: number; captured_today: boolean };
type Peek = { imageUrl: string; label: string } | null;

export default function Today() {
  const [state, setState] = useState<TodayState | null>(null);
  const [peek, setPeek] = useState<Peek>(null);

  useEffect(() => {
    supabase.rpc('get_today_state').then(({ data }) => setState(data?.[0] ?? null));

    supabase.rpc('get_peek_back').then(async ({ data }) => {
      const row = data?.[0];
      if (!row) return;
      const { data: signed } = await supabase.storage.from('captures').createSignedUrl(row.storage_path, 3600);
      if (signed?.signedUrl) setPeek({ imageUrl: signed.signedUrl, label: row.label });
    });
  }, []);

  return (
    <Screen>
      <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1, gap: spacing.lg }}>
        <View style={{ gap: spacing.xxs }}>
          <Text style={{ ...type.caption, color: colors.textMuted }}>Today</Text>
          <Text style={{ ...type.hero, color: colors.textPrimary }}>{state?.current_count ?? 0} day streak</Text>
        </View>

        <PeekBackCard peek={peek} />

        {!state?.captured_today ? (
          <Button label="Capture today's photo" onPress={() => router.push('/capture')} />
        ) : (
          <Text style={{ ...type.bodyBold, color: colors.textPrimary }}>Captured today ✓</Text>
        )}

        <Text style={{ ...type.caption, color: colors.textMuted }}>
          {state?.freezes_remaining ?? 0} freezes left this week
        </Text>
      </Animated.View>
    </Screen>
  );
}
