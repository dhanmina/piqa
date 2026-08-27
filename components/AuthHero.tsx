import { Image, Text, View } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export function AuthHero({ tagline }: { tagline: string }) {
  return (
    <>
      <View style={{ alignItems: 'center', marginBottom: spacing.xs }}>
        <Image source={require('../assets/mark.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
      </View>
      <Text style={{ ...type.wordmark, color: colors.textPrimary, textAlign: 'center' }}>piqa</Text>
      <Text style={{ ...type.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm }}>
        {tagline}
      </Text>
    </>
  );
}
