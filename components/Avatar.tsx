import { Image, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, height, type } from '../lib/theme';

const PERSON_ICON = { ios: 'person.fill', android: 'person' } as const;

export function Avatar({
  url,
  name,
  size = height.control,
  accessibilityLabel = 'Profile photo',
}: {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  accessibilityLabel?: string;
}) {
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };
  if (url) return <Image source={{ uri: url }} style={baseStyle} accessibilityLabel={accessibilityLabel} />;
  const initial = name?.trim()?.[0]?.toUpperCase();
  return (
    <View style={baseStyle}>
      {initial ? (
        <Text style={{ ...type.title, color: colors.textPrimary }}>{initial}</Text>
      ) : (
        <SymbolView name={PERSON_ICON} size={22} tintColor={colors.textMuted} />
      )}
    </View>
  );
}
