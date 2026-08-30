import { View, Text } from 'react-native';
import { Card } from './Card';
import { NetworkImage } from './NetworkImage';
import { colors, spacing, type } from '../lib/theme';

type Peek = { imageUrl: string; label: string };

const HERO_HEIGHT = 260;

export function PeekBackCard({ peek }: { peek: Peek }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ width: '100%', height: HERO_HEIGHT }}>
        <NetworkImage source={{ uri: peek.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ ...type.bodyBold, color: colors.textPrimary }}>{peek.label}</Text>
        </View>
      </View>
    </Card>
  );
}
