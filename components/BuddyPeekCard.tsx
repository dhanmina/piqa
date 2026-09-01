import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { NetworkImage } from './NetworkImage';
import { colors, radius, spacing, touchTarget, type } from '../lib/theme';
import type { BuddyPeek } from '../lib/buddies';

const HEART_ICON = { ios: 'heart', android: 'favorite_border' } as const;
const HEART_FILLED_ICON = { ios: 'heart.fill', android: 'favorite' } as const;
const PHOTO_HEIGHT = 168;

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
    <Card style={{ padding: 0, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', height: PHOTO_HEIGHT }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Your photo, ${peek.label}`}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          <NetworkImage source={{ uri: peek.myPhotoUrl }} cacheKey={peek.myCaptureId} style={{ height: '100%' }} accessibilityLabel="Your photo" />
        </Pressable>

        {/* A hairline seam between the two plates, not a gap -- reads as one
            split instrument reading rather than two separate photos placed side by side. */}
        <View style={{ width: 1, backgroundColor: colors.border }} />

        <Pressable
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel={`${displayName}'s photo, ${peek.label}`}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          <NetworkImage
            source={{ uri: peek.buddyPhotoUrl }}
            cacheKey={peek.buddyCaptureId}
            style={{ height: '100%' }}
            accessibilityLabel={`${displayName}'s photo`}
          />
        </Pressable>
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
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <Avatar url={peek.buddyAvatarUrl} name={displayName} size={32} accessibilityLabel={`${displayName}'s profile photo`} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.bodyBold, color: colors.textPrimary }} numberOfLines={1}>
              You & {displayName}
            </Text>
            <Text style={{ ...type.data, fontSize: 11, color: colors.textFaint }}>{peek.label}</Text>
          </View>
        </View>

        {/* Its own control, not an overlay on the photo above -- an overlay button sitting
            on top of a tap-to-view photo always fights that photo's own Pressable for
            the touch (confirmed the hard way). A bordered pill keeps it reading as a
            tappable control instead of a continuation of the label text beside it. */}
        <Pressable
          onPress={onReact}
          disabled={peek.reactedByMe}
          hitSlop={touchTarget.min / 2}
          accessibilityRole="button"
          accessibilityLabel={peek.reactedByMe ? 'Already reacted' : `React to ${displayName}'s photo`}
          accessibilityState={{ disabled: peek.reactedByMe }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.button,
            borderWidth: 1,
            borderColor: peek.reactedByMe ? colors.textPrimary : colors.border,
            opacity: pressed && !peek.reactedByMe ? 0.6 : 1,
          })}
        >
          <SymbolView
            name={peek.reactedByMe ? HEART_FILLED_ICON : HEART_ICON}
            size={16}
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
      </View>
    </Card>
  );
}
