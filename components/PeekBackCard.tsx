import { View, Text, Image } from 'react-native';
import { Card } from './Card';
import { colors, spacing, radius, type } from '../lib/theme';

type Peek = { imageUrl: string; label: string } | null;

export function PeekBackCard({ peek }: { peek: Peek }) {
  if (!peek) return null;
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Image source={{ uri: peek.imageUrl }} style={{ width: '100%', height: 200, borderRadius: radius.card }} />
      <View style={{ padding: spacing.md }}>
        <Text style={{ ...type.caption, color: colors.textMuted }}>{peek.label}</Text>
      </View>
    </Card>
  );
}
