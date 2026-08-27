import { Text } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export function AuthHero({ tagline }: { tagline: string }) {
  return (
    <>
      <Text style={{ ...type.wordmark, color: colors.textPrimary, textAlign: 'center' }}>piqa</Text>
      <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm }}>
        {tagline}
      </Text>
    </>
  );
}
