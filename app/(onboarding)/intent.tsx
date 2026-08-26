import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { saveIntentTheme } from '../../lib/onboarding';

const SUGGESTED = ['Track a transformation', 'Practice a craft', 'Just capture daily'];

export default function Intent() {
  async function choose(theme: string | null) {
    await saveIntentTheme(theme);
    router.push('/(onboarding)/permissions');
  }
  return (
    <View>
      <Text>What are you capturing?</Text>
      {SUGGESTED.map((t) => (
        <Pressable key={t} onPress={() => choose(t)}><Text>{t}</Text></Pressable>
      ))}
      <Pressable onPress={() => choose(null)}><Text>Skip</Text></Pressable>
    </View>
  );
}
