import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Card } from './Card';
import { NetworkImage } from './NetworkImage';
import { colors, spacing, type } from '../lib/theme';

const POP_SPRING = { damping: 14, stiffness: 300 };
const HERO_HEIGHT = 260;

export function CapturedTodayCard({
  onView,
  imageUrl,
  count = 1,
}: {
  onView: () => void;
  imageUrl?: string | null;
  count?: number;
}) {
  const scale = useSharedValue(0.92);

  useEffect(() => {
    scale.value = withSpring(1, POP_SPRING);
  }, [scale]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onView}>
      <Animated.View style={scaleStyle}>
        <Card style={{ padding: 0, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <View style={{ width: '100%', height: HERO_HEIGHT }}>
            {imageUrl ? (
              <NetworkImage source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.textMuted} />
              </View>
            )}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text
              style={{
                ...type.caption,
                fontSize: 10.5,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: colors.textFaint,
              }}
            >
              Captured today
            </Text>
            <Text style={{ ...type.data, color: colors.textPrimary }}>
              {count > 1 ? `${count} photos` : '1 photo'}
            </Text>
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}
