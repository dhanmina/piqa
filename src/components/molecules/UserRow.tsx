import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { displayFamily } from '@/components/fonts';
import { avatar, colors, fonts, space, typeScale } from '@/components/tokens';

type Props = {
  /** Raw username — rendered as a @handle and used for the avatar's fallback initial. */
  username: string;
  avatarUri?: string | null;
  /** A quiet second line (e.g. a metric). Omit to keep the row to one line. */
  subtitle?: string;
  /** Trailing control — a follow/unfollow button, a "YOU" tag, etc. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Search's row is deliberately the next tier up (avatar.xl) — its own legitimate outlier. */
  avatarSize?: number;
};

/**
 * A person row: avatar + @username (+ optional subtitle) with a trailing slot.
 * Shared list row so the Following list, search, and any future people list read
 * identically instead of each hand-rolling one.
 */
export const UserRow = React.memo(function UserRow({ username, avatarUri, subtitle, trailing, onPress, avatarSize = avatar.lg }: Props) {
  return (
    <Pressable accessibilityRole="button" style={styles.row} onPress={onPress} disabled={!onPress}>
      <Avatar username={username} uri={avatarUri} size={avatarSize} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          @{username}
        </Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  info: { flex: 1, gap: space.hair },
  name: { fontFamily: displayFamily, fontSize: typeScale.body, color: colors.paper },
  sub: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
});
