import { Text, Pressable } from 'react-native';
import { colors, spacing, radius, type, touchTarget } from '../lib/theme';

export function SelectableRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.pressedOverlay : colors.surface,
        borderRadius: radius.card,
        minHeight: touchTarget.min,
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
      })}
    >
      <Text style={{ ...type.body, color: colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
}
