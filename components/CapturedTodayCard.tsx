import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Card } from './Card';
import { NetworkImage } from './NetworkImage';
import { RegistrationMark } from './RegistrationMark';
import { colors, spacing, type } from '../lib/theme';

const POP_SPRING = { damping: 14, stiffness: 300 };
const HERO_HEIGHT = 260;

export function CapturedTodayCard({
  onView,
  onAddCapture,
  imageUrl,
  count = 1,
}: {
  onView: () => void;
  onAddCapture: () => void;
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
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ width: '100%', height: HERO_HEIGHT }}>
            {imageUrl ? (
              <NetworkImage source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...type.dataHero, color: colors.textPrimary }}>OK</Text>
              </View>
            )}

            {/* Same plate framing as PeekBackCard — a stamped record, not a social card. */}
            <RegistrationMark corner="tl" />
            <RegistrationMark corner="tr" />
            <RegistrationMark corner="bl" />
            <RegistrationMark corner="br" />

            <Pressable
              onPress={onAddCapture}
              hitSlop={8}
              style={({ pressed }) => ({
                position: 'absolute',
                top: spacing.sm,
                right: spacing.sm,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(10,10,10,0.72)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ ...type.bodyBold, color: colors.textPrimary, lineHeight: 20 }}>+</Text>
            </Pressable>

            <View
              style={{
                position: 'absolute',
                top: spacing.sm,
                left: spacing.sm,
                backgroundColor: 'rgba(10,10,10,0.72)',
                borderRadius: 4,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                gap: 2,
              }}
            >
              <Text
                style={{
                  ...type.caption,
                  fontSize: 9,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                }}
              >
                Captured today
              </Text>
              <Text style={{ ...type.data, color: colors.textPrimary }}>
                {count > 1 ? `${count} photos` : '1 photo'}
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}
