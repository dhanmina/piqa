import { Check, Lock } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { frameClaimable, frameOwned, useFrameCatalog, type FrameId } from '@lib/frames';
import { Mono } from '@/components/atoms/Mono';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

type FramePickerProps = {
  equipped: FrameId;
  /** Frames this user has unlocked (default frames are always implied). */
  owned: FrameId[];
  /** A real photo of theirs, so the preview shows the frame doing its job. */
  previewUri?: string | null;
  previewDay: number;
  onEquip: (id: FrameId) => void;
  /** Claim an in-window event frame (grants ownership, then it can be equipped). */
  onClaim: (id: FrameId) => void;
  busy?: boolean;
};

/**
 * One frame for the whole account, not one per photo. Equipping re-skins every
 * photo you have ever taken the moment it lands, because the frame is an overlay
 * and the photos underneath were never touched.
 *
 * Driven entirely by the catalog (data), so a frame added from the dashboard shows
 * up here with no code change. A locked frame is shown, not hidden — the point of a
 * frame is seeing what it takes to earn it.
 */
export function FramePicker({ equipped, owned, previewUri, previewDay, onEquip, onClaim, busy }: FramePickerProps) {
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
        const claimable = !isOwned && frameClaimable(f);

        const onPress = isOwned ? () => onEquip(f.id) : claimable ? () => onClaim(f.id) : undefined;

        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isEquipped, disabled: !onPress || busy || isEquipped }}
            accessibilityLabel={
              isOwned ? `Equip the ${f.label} frame` : claimable ? `Claim the ${f.label} frame` : `${f.label} frame, locked`
            }
            disabled={!onPress || busy || isEquipped}
            style={[styles.row, isEquipped && styles.rowEquipped, !isOwned && !claimable && styles.rowLocked]}
            onPress={onPress}
          >
            <FramedPhoto photoUri={previewUri} dayNumber={previewDay} frameId={f.id} width={64} />

            <View style={styles.meta}>
              <Text style={styles.label}>{f.label}</Text>
              {isOwned ? (
                <Mono size={typeScale.caption} color={isEquipped ? colors.safelight : colors.paper60}>
                  {isEquipped ? 'EQUIPPED' : 'TAP TO EQUIP'}
                </Mono>
              ) : claimable ? (
                <Mono size={typeScale.caption} color={colors.safelight}>
                  TAP TO CLAIM
                </Mono>
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
    gap: 14,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowEquipped: { borderColor: colors.safelight },
  rowLocked: { opacity: 0.55 },
  meta: { flex: 1, gap: 3 },
  label: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.paper },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  unlock: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper40 },
});
