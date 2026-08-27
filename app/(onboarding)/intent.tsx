import { Text, Pressable, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { saveIntentTheme } from '../../lib/onboarding';
import { colors, spacing, touchTarget, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { SelectableRow } from '../../components/SelectableRow';
import { OnboardingProgress } from '../../components/OnboardingProgress';

const SUGGESTED = ['Track a transformation', 'Watch something grow', 'Document a project', 'Just capture daily'];

export default function Intent() {
  async function choose(intentTheme: string | null) {
    await saveIntentTheme(intentTheme);
    router.push('/(onboarding)/permissions');
  }
  return (
    <Screen>
      <OnboardingProgress step={1} total={2} />
      <Animated.View
        entering={FadeInUp.duration(220)}
        style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ ...type.screenTitle, color: colors.textPrimary, textAlign: 'center' }}>
            What are you capturing?
          </Text>
          <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>
            You can change this anytime in your profile.
          </Text>
        </View>
        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          {SUGGESTED.map((t) => (
            <SelectableRow key={t} label={t} onPress={() => choose(t)} />
          ))}
          <Pressable
            onPress={() => choose(null)}
            style={{ minHeight: touchTarget.min, justifyContent: 'center', paddingHorizontal: spacing.md }}
          >
            <Text style={{ ...type.caption, color: colors.textMuted, textAlign: 'center' }}>Skip</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Screen>
  );
}
