import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { saveIntentTheme } from '../../lib/onboarding';
import { colors, spacing, radius, type } from '../../lib/theme';

const SUGGESTED = ['Track a transformation', 'Practice a craft', 'Just capture daily'];

export default function Intent() {
  async function choose(intentTheme: string | null) {
    await saveIntentTheme(intentTheme);
    router.push('/(onboarding)/permissions');
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background }}>
      <Text style={{ ...type.hero, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.sm }}>What are you capturing?</Text>
      {SUGGESTED.map((t) => (
        <Pressable
          key={t}
          onPress={() => choose(t)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.background : colors.surface,
            borderRadius: radius.card,
            padding: spacing.md,
          })}
        >
          <Text style={{ ...type.body, color: colors.textPrimary }}>{t}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => choose(null)} style={{ padding: spacing.md }}>
        <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>Skip</Text>
      </Pressable>
    </View>
  );
}
