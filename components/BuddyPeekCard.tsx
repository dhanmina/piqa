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

      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Your photo, ${peek.label}`}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          <NetworkImage
            source={{ uri: peek.myPhotoUrl }}
            cacheKey={peek.myCaptureId}
            style={{ height: PHOTO_HEIGHT, borderRadius: radius.card }}
            accessibilityLabel="Your photo"
          />
        </Pressable>
        <Pressable
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel={`${displayName}'s photo, ${peek.label}`}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          <NetworkImage
            source={{ uri: peek.buddyPhotoUrl }}
            cacheKey={peek.buddyCaptureId}
            style={{ height: PHOTO_HEIGHT, borderRadius: radius.card }}
            accessibilityLabel={`${displayName}'s photo`}
          />
        </Pressable>
      </View>

      {/* Its own row, not an overlay on the photo above -- an overlay button sitting
          on top of a tap-to-view photo always fights that photo's own Pressable for
          the touch (confirmed the hard way). A dedicated row below removes the
          conflict at the layout level instead of patching it with zIndex. */}
      <Pressable
        onPress={onReact}
        disabled={peek.reactedByMe}
        accessibilityRole="button"
        accessibilityLabel={peek.reactedByMe ? 'Already reacted' : `React to ${displayName}'s photo`}
        accessibilityState={{ disabled: peek.reactedByMe }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: spacing.xxs,
          minHeight: touchTarget.min,
          opacity: pressed && !peek.reactedByMe ? 0.6 : 1,
        })}
      >
        <SymbolView
          name={peek.reactedByMe ? HEART_FILLED_ICON : HEART_ICON}
          size={18}
          tintColor={peek.reactedByMe ? colors.accent : colors.textMuted}
        />
        <Text
          style={{
            ...type.caption,
            color: peek.reactedByMe ? colors.textPrimary : colors.textMuted,
            fontWeight: peek.reactedByMe ? '600' : '400',
          }}
        >
          {peek.reactedByMe ? 'Reacted' : 'React'}
        </Text>
      </Pressable>
    </Card>
  );
}
