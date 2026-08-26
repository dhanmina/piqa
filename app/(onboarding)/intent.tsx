import { Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { saveIntentTheme } from '../../lib/onboarding';
import { colors, spacing, type } from '../../lib/theme';
import { Screen } from '../../components/Screen';
import { SelectableRow } from '../../components/SelectableRow';

const SUGGESTED = ['Track a transformation', 'Practice a craft', 'Just capture daily'];

export default function Intent() {
  async function choose(intentTheme: string | null) {
    await saveIntentTheme(intentTheme);
    router.push('/(onboarding)/permissions');
  }
  return (
    <Screen style={{ justifyContent: 'center', gap: spacing.md }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm }}>What are you capturing?</Text>
      {SUGGESTED.map((t) => (
        <SelectableRow key={t} label={t} onPress={() => choose(t)} />
      ))}
      <Pressable onPress={() => choose(null)} style={{ padding: spacing.md }}>
        <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center' }}>Skip</Text>
      </Pressable>
    </Screen>
  );
}
