import { View } from 'react-native';
import { colors, spacing } from '../lib/theme';

const BAR_HEIGHT = 4;

export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={{ flexDirection: 'row', gap: spacing.xs }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: BAR_HEIGHT,
            borderRadius: BAR_HEIGHT / 2,
            backgroundColor: i < step ? colors.accent : colors.border,
          }}
        />
      ))}
    </View>
  );
}
