import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { NetworkImage } from './NetworkImage';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';
import type { BuddyPeek } from '../lib/buddies';

const HEART_ICON = { ios: 'heart', android: 'favorite_border' } as const;
const HEART_FILLED_ICON = { ios: 'heart.fill', android: 'favorite' } as const;
const PHOTO_HEIGHT = 160;

export function BuddyPeekCard({
  peek,
  onPress,
  onReact,
}: {
  peek: BuddyPeek;
  onPress: () => void;
  onReact: () => void;
}) {
  const displayName = peek.buddyDisplayName ?? peek.buddyUsername;

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar url={peek.buddyAvatarUrl} name={displayName} size={28} accessibilityLabel={`${displayName}'s profile photo`} />
        <Text style={{ ...type.bodyBold, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
          You & {displayName}
        </Text>
        <Text style={{ ...type.caption, color: colors.textMuted }}>{peek.label}</Text>
      </View>

      <Pressable
        onPress={onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Buddy Peek photos, you and ${displayName}, ${peek.label}`}
        style={({ pressed }) => ({ flexDirection: 'row', gap: spacing.xs, opacity: pressed ? 0.85 : 1 })}
      >
        <NetworkImage
          source={{ uri: peek.myPhotoUrl }}
          cacheKey={peek.myCaptureId}
          style={{ flex: 1, height: PHOTO_HEIGHT, borderRadius: radius.card }}
          accessibilityLabel="Your photo"
        />
        <View style={{ flex: 1 }}>
          <NetworkImage
            source={{ uri: peek.buddyPhotoUrl }}
            cacheKey={peek.buddyCaptureId}
            style={{ height: PHOTO_HEIGHT, borderRadius: radius.card }}
            accessibilityLabel={`${displayName}'s photo`}
          />
          <Pressable
            onPress={onReact}
            disabled={peek.reactedByMe}
            hitSlop={touchTarget.min / 2}
            accessibilityRole="button"
            accessibilityLabel={peek.reactedByMe ? 'Already reacted' : `React to ${displayName}'s photo`}
            accessibilityState={{ disabled: peek.reactedByMe }}
            style={{
              position: 'absolute',
              bottom: spacing.xs,
              right: spacing.xs,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SymbolView
              name={peek.reactedByMe ? HEART_FILLED_ICON : HEART_ICON}
              size={16}
              tintColor={peek.reactedByMe ? colors.accent : colors.textPrimary}
            />
          </Pressable>
        </View>
      </Pressable>
    </Card>
  );
}
