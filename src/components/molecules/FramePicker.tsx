import { Check, Lock } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { frameOwned, framePurchasable } from '@lib/services/frames';
import { useFrameCatalog } from '@lib/hooks/frames';
import type { FrameId } from '@lib/services/frames';
import { Mono } from '@/components/atoms/Mono';
import { FramedAvatar } from '@/components/molecules/FramedAvatar';
import { avatar, colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

type FramePickerProps = {
  equipped: FrameId;
  /** Frames this user has unlocked (default frames are always implied). */
  owned: FrameId[];
  /** The viewer's avatar + name + level, so each row previews the frame's ring on
   *  their own face (default falls back to the level ring). */
  avatarUri?: string | null;
  username: string;
  level: number;
  onEquip: (id: FrameId) => void;
  busy?: boolean;
  /** Called with a frame's RevenueCat/Play product id when a locked purchasable
   *  row is tapped. Omit to render purchasable rows as plain locked rows. */
  onBuy?: (productId: string) => void;
  /** The product id currently mid-purchase, so its row can show a busy state. */
  buying?: string | null;
  /** Store-localized price string for a product id, or null while offerings are
   *  still loading (falls back to the frame's unlockLabel). */
  priceFor?: (productId: string) => string | null;
};

/**
 * The PROFILE frame — one for the whole account, worn as the avatar ring everywhere
 * your face shows. It no longer touches photos (each photo wears its own day's frame),
 * so this is a pure identity flex you can equip freely.
 *
 * Driven entirely by the catalog (data), so a frame added from the dashboard shows
 * up here with no code change. A locked frame is shown, not hidden — the point of a
 * frame is seeing what it takes to earn it. A locked purchasable frame shows a price
 * instead of an unlock condition, and tapping it buys instead of doing nothing.
 */
export function FramePicker({
  equipped,
  owned,
  avatarUri,
  username,
  level,
  onEquip,
  busy,
  onBuy,
  buying,
  priceFor,
}: FramePickerProps) {
  const catalog = useFrameCatalog();

  // Default frame(s) first, then the rest by label — a stable, readable order.
  const frames = useMemo(() => {
    return [...catalog.values()].sort((a, b) => {
      if ((a.unlockKind === 'default') !== (b.unlockKind === 'default')) return a.unlockKind === 'default' ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [catalog]);

  return (
    <View style={styles.list}>
      {frames.map((f) => {
        const isOwned = frameOwned(f, owned);
        const isEquipped = equipped === f.id;
        const isPurchasable = framePurchasable(f, owned);
        const isBuying = buying === f.productId;

        const onPress = isOwned
          ? () => onEquip(f.id)
          : isPurchasable && onBuy && f.productId
            ? () => onBuy(f.productId as string)
            : undefined;

        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isEquipped, disabled: !onPress || busy || isEquipped || isBuying }}
            accessibilityLabel={
              isOwned
                ? `Equip the ${f.label} frame`
                : isPurchasable
                  ? `Buy the ${f.label} frame`
                  : `${f.label} frame, locked`
            }
            disabled={!onPress || busy || isEquipped || isBuying}
            style={[styles.row, isEquipped && styles.rowEquipped, !isOwned && styles.rowLocked]}
            onPress={onPress}
          >
            <View style={styles.preview}>
              <FramedAvatar uri={avatarUri} username={username} frameId={f.id} level={level} size={avatar.lg} />
            </View>

            <View style={styles.meta}>
              <Text style={styles.label}>{f.label}</Text>
              {isOwned ? (
                <Mono size={typeScale.caption} color={isEquipped ? colors.safelight : colors.paper60}>
                  {isEquipped ? 'EQUIPPED' : 'TAP TO EQUIP'}
                </Mono>
              ) : isPurchasable ? (
                <View style={styles.lockRow}>
                  <Text style={styles.unlock}>
                    {isBuying ? 'Buying…' : (f.productId && priceFor?.(f.productId)) || f.unlockLabel || 'Buy'}
                  </Text>
                </View>
              ) : (
                <View style={styles.lockRow}>
                  <Lock size={11} strokeWidth={icons.strokeWidth} color={colors.paper40} />
                  <Text style={styles.unlock}>{f.unlockLabel ?? 'Locked'}</Text>
                </View>
              )}
            </View>

            {isEquipped && <Check size={18} strokeWidth={icons.strokeWidth} color={colors.safelight} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.gridGap, alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.smPlus,
    padding: space.xsPlus,
    borderRadius: radius.card,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowEquipped: { borderColor: colors.safelight },
  rowLocked: { opacity: 0.55 },
  // Fixed-width slot so avatars line up even though the ring changes the outer size.
  preview: { width: 56, alignItems: 'center' },
  meta: { flex: 1, gap: space.hair },
  label: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.paper },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  unlock: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper40 },
});
