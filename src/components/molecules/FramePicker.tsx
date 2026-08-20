import { Check, Lock } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { frameOwned, framePurchasable } from '@lib/services/frames';
import { useFrameCatalog } from '@lib/hooks/frames';
import type { FrameDef, FrameId } from '@lib/services/frames';
import { FramedAvatar } from '@/components/molecules/FramedAvatar';
import { avatar, colors, fonts, icons, space, typeScale } from '@/components/tokens';

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
  const { height: winH } = useWindowDimensions();

  // unlock_kind='manual' frames (e.g. the retired Golden/Blue Hour pack) are
  // fully hidden here, not just non-purchasable — existing owners keep them
  // equipped and rendered everywhere else, they just don't clutter the equip
  // sheet's current lineup.
  //
  // One continuous grid, ordered rather than labeled: default/earned frames
  // first (no price — the earn condition already shows in their own caption),
  // then purchase tiers cheapest first, alpha within each group. Each locked
  // cell's own caption already carries its price, so a tier header above it
  // would just repeat that.
  const frames = useMemo(() => {
    const visible = [...catalog.values()].filter((f) => f.unlockKind !== 'manual');
    const byLabel = (a: FrameDef, b: FrameDef) => a.label.localeCompare(b.label);

    const yours = visible
      .filter((f) => f.unlockKind !== 'purchase')
      .sort((a, b) => {
        if ((a.unlockKind === 'default') !== (b.unlockKind === 'default')) return a.unlockKind === 'default' ? -1 : 1;
        return byLabel(a, b);
      });
    const singles = visible.filter((f) => f.unlockKind === 'purchase' && !f.ringGradient).sort(byLabel);
    const elaborate = visible.filter((f) => f.unlockKind === 'purchase' && f.ringGradient && !f.shimmer).sort(byLabel);
    const animated = visible.filter((f) => f.unlockKind === 'purchase' && f.shimmer).sort(byLabel);

    return [...yours, ...singles, ...elaborate, ...animated];
  }, [catalog]);

  return (
    <ScrollView style={{ maxHeight: winH * 0.62 }} showsVerticalScrollIndicator={false}>
      <View style={styles.grid}>
        {frames.map((f) => {
          const isOwned = frameOwned(f, owned);
          const isEquipped = equipped === f.id;
          const isPurchasable = framePurchasable(f, owned);
          const isBuying = buying != null && buying === f.productId;
          // Only show buy-style UI (text and accessibility label) if both purchasable AND onBuy is supplied.
          // Without onBuy, falls through to plain locked rendering per the doc comment.
          const showBuyRow = isPurchasable && Boolean(onBuy);

          const onPress = isOwned
            ? () => onEquip(f.id)
            : isPurchasable && onBuy && f.productId
              ? () => onBuy(f.productId as string)
              : undefined;

          // Owned cells stay unlabeled below the name — the check badge already
          // says equipped, and "tap to equip" on every other cell was just noise.
          // Locked cells keep a caption because it's the one piece of info that
          // decides whether to tap: what it costs, or what it takes to earn.
          const caption = isOwned
            ? null
            : showBuyRow
              ? isBuying
                ? 'Buying…'
                : (f.productId && priceFor?.(f.productId)) || f.unlockLabel || 'Buy'
              : f.unlockLabel ?? 'Locked';

          return (
            <Pressable
              key={f.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isEquipped, disabled: !onPress || busy || isEquipped || isBuying }}
              accessibilityLabel={
                isOwned
                  ? `Equip the ${f.label} frame`
                  : showBuyRow
                    ? `Buy the ${f.label} frame`
                    : `${f.label} frame, locked`
              }
              disabled={!onPress || busy || isEquipped || isBuying}
              style={[styles.cell, !isOwned && styles.cellLocked]}
              onPress={onPress}
            >
              <View style={styles.preview}>
                <FramedAvatar uri={avatarUri} username={username} frameId={f.id} level={level} size={avatar.xl} />
                {isEquipped ? (
                  <View style={styles.badge}>
                    <Check size={11} strokeWidth={icons.strokeWidth} color={colors.ink} />
                  </View>
                ) : !isOwned && !showBuyRow ? (
                  <View style={[styles.badge, styles.badgeLock]}>
                    <Lock size={9} strokeWidth={icons.strokeWidth} color={colors.paper60} />
                  </View>
                ) : null}
              </View>

              <Text style={[styles.label, isEquipped && styles.labelEquipped]} numberOfLines={1}>
                {f.label}
              </Text>
              {caption && (
                <Text style={styles.caption} numberOfLines={1}>
                  {caption}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: {
    width: '30%',
    alignItems: 'center',
    gap: space.xxs,
  },
  cellLocked: { opacity: 0.55 },
  preview: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.safelight,
    borderWidth: 2,
    borderColor: colors.ink2,
  },
  badgeLock: { backgroundColor: colors.ink, borderColor: colors.ink2 },
  label: { fontFamily: fonts.sansMedium, fontSize: typeScale.caption, color: colors.paper, textAlign: 'center' },
  labelEquipped: { color: colors.safelight },
  caption: { fontFamily: fonts.sans, fontSize: typeScale.tabLabel, color: colors.paper40, textAlign: 'center' },
});
