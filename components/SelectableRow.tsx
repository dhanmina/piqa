import { Text, Pressable } from 'react-native';
import { colors, spacing, radius, type } from '../lib/theme';

export function SelectableRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.background : colors.surface,
        borderRadius: radius.card,
        padding: spacing.md,
      })}
    >
      <Text style={{ ...type.body, color: colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}
