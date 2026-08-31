import { Pressable, View, Text } from 'react-native';
import { Card } from './Card';
import { NetworkImage } from './NetworkImage';
import { colors, spacing, type } from '../lib/theme';

type Peek = { imageUrl: string; label: string };

const HERO_HEIGHT = 260;

export function PeekBackCard({ peek, onPress }: { peek: Peek; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Peek back photo, ${peek.label}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card style={{ padding: 0, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <NetworkImage
          source={{ uri: peek.imageUrl }}
          style={{ width: '100%', height: HERO_HEIGHT }}
          contentFit="cover"
        />

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
            Peek back
          </Text>
          <Text style={{ ...type.data, color: colors.textPrimary }}>{peek.label}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
