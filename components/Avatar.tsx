import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { CameraIcon } from './NavIcons';
import { colors, height, type } from '../lib/theme';

const PERSON_ICON = { ios: 'person.fill', android: 'person' } as const;
const PRESS_SPRING = { damping: 18, stiffness: 400 };

export function Avatar({
  url,
  name,
  size = height.control,
  accessibilityLabel = 'Profile photo',
  editable = false,
  onPress,
  uploading = false,
}: {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  accessibilityLabel?: string;
  // Renders a camera badge and makes the avatar itself pressable — used only on
  // the one dedicated editing surface (edit-profile), never in read-only
  // contexts like buddy rows or the Profile header, per the app's one-entry-
  // point-per-action convention.
  editable?: boolean;
  onPress?: () => void;
  uploading?: boolean;
}) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Hairline border matches the recorder world's photo-plate identity
  // (PeekBackCard, CapturedTodayCard) so a profile photo reads as the same
  // instrument-grade plate, just circular.
  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };

  const initial = name?.trim()?.[0]?.toUpperCase();
  const content = url ? (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size }}
      accessibilityLabel={accessibilityLabel}
      cachePolicy="disk"
    />
  ) : initial ? (
    <Text style={{ ...type.title, color: colors.textPrimary }}>{initial}</Text>
  ) : (
    <SymbolView name={PERSON_ICON} size={Math.round(size * 0.42)} tintColor={colors.textMuted} />
  );

  const circle = (
    <Animated.View style={[circleStyle, editable && scaleStyle]}>
      {content}
      {uploading ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: size / 2,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : null}
    </Animated.View>
  );

  if (!editable) return circle;

  const badgeSize = Math.max(28, Math.round(size * 0.32));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.96, PRESS_SPRING))}
      onPressOut={() => (scale.value = withSpring(1, PRESS_SPRING))}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens your photo library to change it"
      accessibilityState={{ busy: uploading }}
      style={{ width: size, height: size }}
    >
      {circle}
      <View
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CameraIcon size={Math.round(badgeSize * 0.48)} color={colors.textPrimary} />
      </View>
    </Pressable>
  );
}
