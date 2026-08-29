import { Text, View } from 'react-native';
import { colors, type } from '../lib/theme';

export function FieldError({ message }: { message: string | null }) {
  return (
    <View style={{ minHeight: type.caption.lineHeight, justifyContent: 'center' }}>
      <Text
        accessibilityLiveRegion="polite"
        style={{ ...type.caption, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}
      >
        {message ?? ''}
      </Text>
    </View>
  );
}
