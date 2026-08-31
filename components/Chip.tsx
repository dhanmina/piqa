import { Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../lib/theme';

export function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: radius.button,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Text style={{ ...type.caption, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}
