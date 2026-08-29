import { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Card } from './Card';
import { colors, spacing, type } from '../lib/theme';

const POP_SPRING = { damping: 14, stiffness: 300 };
const HERO_HEIGHT = 260;

export function CapturedTodayCard({
  onPress,
  imageUrl,
  count = 1,
}: {
  onPress: () => void;
  imageUrl?: string | null;
  count?: number;
}) {
  const scale = useSharedValue(0.92);

  useEffect(() => {
    scale.value = withSpring(1, POP_SPRING);
  }, [scale]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={scaleStyle}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ width: '100%', height: HERO_HEIGHT }}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...type.hero, color: colors.textPrimary }}>{'✓'}</Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                backgroundColor: 'rgba(0,0,0,0.55)',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Text
                style={{ ...type.bodyBold, color: colors.textPrimary, flexShrink: 1 }}
                numberOfLines={1}
              >
                {count > 1 ? `Captured today · ${count} photos` : 'Captured today'}
              </Text>
              <Text style={{ ...type.caption, color: colors.textMuted, flexShrink: 0 }}>
                Tap to add another
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}
