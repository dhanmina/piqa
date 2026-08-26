import { View, Text, Pressable } from 'react-native';
import { signInWithGoogle } from '../../lib/auth';
import { colors, spacing, radius, type } from '../../lib/theme';

export default function SignIn() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.background }}>
      <Text style={{ ...type.body, textAlign: 'center', color: colors.textPrimary }}>Capture daily. Keep your streak. Peek into your past.</Text>
      <Pressable
        onPress={signInWithGoogle}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.accentPressed : colors.accent,
          paddingVertical: spacing.md - 2,
          paddingHorizontal: spacing.lg + 4,
          borderRadius: radius.button,
        })}
      >
        <Text style={{ ...type.bodyBold, color: colors.background }}>Sign in with Google</Text>
      </Pressable>
    </View>
  );
}
