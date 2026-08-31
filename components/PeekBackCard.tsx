import { View, Text } from 'react-native';
import { Card } from './Card';
import { NetworkImage } from './NetworkImage';
import { RegistrationMark } from './RegistrationMark';
import { colors, spacing, type } from '../lib/theme';

type Peek = { imageUrl: string; label: string };

const HERO_HEIGHT = 260;

export function PeekBackCard({ peek }: { peek: Peek }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ width: '100%', height: HERO_HEIGHT }}>
        <NetworkImage source={{ uri: peek.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />

        {/* Registration marks — the recorder head re-lighting an old frame reads as a
            filed archival plate, not a social card, so the label sits in a stamped tab
            with corner ticks rather than a bottom gradient caption. */}
        <RegistrationMark corner="tl" />
        <RegistrationMark corner="tr" />
        <RegistrationMark corner="bl" />
        <RegistrationMark corner="br" />

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
            Peek back
          </Text>
          <Text style={{ ...type.data, color: colors.textPrimary }}>{peek.label}</Text>
        </View>
      </View>
    </Card>
  );
}
