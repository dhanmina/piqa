import { Check, Lock } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FRAMES, type FrameId } from '@lib/frames';
import { Mono } from '@/components/atoms/Mono';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

type FramePickerProps = {
  equipped: FrameId;
  /** Frames this user has actually unlocked. 'default' is always implied. */
  owned: FrameId[];
  /** A real photo of theirs, so the preview shows the frame doing its job. */
  previewUri?: string | null;
  /** The day number under the preview — a real one if we have it. */
  previewDay: number;
  onEquip: (id: FrameId) => void;
  busy?: boolean;
};

/**
 * One frame for the whole account, not one per photo. Equipping re-skins every
 * photo you have ever taken the moment it lands, because the frame is an overlay
 * and the photos underneath were never touched.
 *
 * A locked frame is shown, not hidden: the point of the crown is that you can see
 * what winning gets you. It is unlocked by close_day and nothing else — there is
 * no price, and no client path that can grant it.
 */
export function FramePicker({ equipped, owned, previewUri, previewDay, onEquip, busy }: FramePickerProps) {
  return (
    <View style={styles.list}>
      {FRAMES.map((f) => {
        const unlocked = f.id === 'default' || owned.includes(f.id);
        const isEquipped = equipped === f.id;

        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isEquipped, disabled: !unlocked || busy }}
            accessibilityLabel={
              unlocked ? `Equip the ${f.label} frame` : `${f.label} frame, locked — ${f.unlock}`
            }
            disabled={!unlocked || busy || isEquipped}
            style={[styles.row, isEquipped && styles.rowEquipped, !unlocked && styles.rowLocked]}
            onPress={() => onEquip(f.id)}
          >
            <FramedPhoto photoUri={previewUri} dayNumber={previewDay} frameId={f.id} width={64} />

            <View style={styles.meta}>
              <Text style={styles.label}>{f.label}</Text>
              {unlocked ? (
                <Mono size={typeScale.caption} color={isEquipped ? colors.safelight : colors.paper60}>
                  {isEquipped ? 'EQUIPPED' : 'TAP TO EQUIP'}
                </Mono>
              ) : (
                <View style={styles.lockRow}>
                  <Lock size={11} strokeWidth={icons.strokeWidth} color={colors.paper40} />
                  <Text style={styles.unlock}>{f.unlock}</Text>
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
