import { Text, View } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export function Divider({ label }: { label?: string }) {
  if (!label) {
    return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.lg }} />;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ ...type.caption, color: colors.textMuted, marginHorizontal: spacing.md }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
