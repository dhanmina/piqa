import type { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { colors, spacing, radius } from '../lib/theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        padding: spacing.md,
        ...style,
      }}
    >
      {children}
    </View>
  );
}
