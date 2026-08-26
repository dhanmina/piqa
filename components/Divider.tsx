import { View } from 'react-native';
import { colors, spacing } from '../lib/theme';

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.lg }} />;
}
