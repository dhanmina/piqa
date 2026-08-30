import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';
import type { Buddy } from '../lib/buddies';

const HEART_ICON = { ios: 'heart', android: 'favorite_border' } as const;
const HEART_FILLED_ICON = { ios: 'heart.fill', android: 'favorite' } as const;
const SNOWFLAKE_ICON = { ios: 'snowflake', android: 'ac_unit' } as const;

function statusLabel(status: Buddy['status']): string {
  switch (status) {
    case 'captured_today':
      return 'Captured today';
    case 'frozen_today':
      return 'Frozen today';
    case 'at_risk':
      return "Hasn't captured yet today";
    default:
      return 'No active streak';
  }
}

export function BuddyRow({ buddy, onReact }: { buddy: Buddy; onReact: (captureId: string) => void }) {
  const displayName = buddy.displayName ?? buddy.username;

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Avatar url={buddy.avatarUrl} name={displayName} accessibilityLabel={`${displayName}'s profile photo`} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={{ ...type.bodyBold, color: colors.textPrimary }} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {buddy.status === 'frozen_today' && <SymbolView name={SNOWFLAKE_ICON} size={14} tintColor={colors.textMuted} />}
          <Text style={{ ...type.caption, color: colors.textMuted }}>
            {buddy.currentCount} {buddy.currentCount === 1 ? 'day' : 'days'} · {statusLabel(buddy.status)}
          </Text>
        </View>
      </View>
      {buddy.todayPhotoUrl && buddy.todayCaptureId ? (
        <View style={{ alignItems: 'center', gap: spacing.xxs }}>
          <Image
            source={{ uri: buddy.todayPhotoUrl }}
            accessibilityLabel={`${displayName}'s photo today`}
            style={{ width: 44, height: 44, borderRadius: radius.card }}
            cachePolicy="disk"
          />
          <Pressable
            onPress={() => onReact(buddy.todayCaptureId!)}
            disabled={buddy.reactedByMe}
            hitSlop={touchTarget.min / 2}
            accessibilityRole="button"
            accessibilityLabel={buddy.reactedByMe ? 'Already reacted' : `React to ${displayName}'s photo`}
            accessibilityState={{ disabled: buddy.reactedByMe }}
          >
            <SymbolView
              name={buddy.reactedByMe ? HEART_FILLED_ICON : HEART_ICON}
              size={22}
              tintColor={buddy.reactedByMe ? colors.accent : colors.textMuted}
            />
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}
