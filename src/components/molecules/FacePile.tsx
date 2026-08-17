/**
 * FacePile — the profile's Following affordance. Shows the FACES you follow, not a
 * settings-style "Following ›" row and never a count (spec §9). The faces are the
 * signal: warm, human, on-brand for a photo app, and count-free by construction.
 *
 * Layout law: the "Following" label is anchored LEFT and the chevron is pinned
 * RIGHT, so only the face cluster in the middle changes width. Nothing the eye
 * reads as a label ever shifts as the follow count changes. Empty (0 follows) is a
 * soft invitation into discovery, sharing the exact same row skeleton so the two
 * states don't jump either.
 */
import { ChevronRight, UserPlus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { avatar, colors, fonts, icons, typeScale } from '@/components/tokens';

type Face = { id: string; username: string; avatar_url: string | null };

type Props = {
  faces: Face[];
  onPress?: () => void;
  /** How many faces to render before we stop (no "+N" — that'd be a count). */
  max?: number;
};

const SIZE = avatar.sm;
const OVERLAP = 11; // how far each face tucks under the previous one

export function FacePile({ faces, onPress, max = 5 }: Props) {
  const shown = faces.slice(0, max);
  const empty = shown.length === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={empty ? 'Find photographers to follow' : 'Following'}
      style={styles.row}
      onPress={onPress}
    >
      {empty ? (
        // 0 follows: an invitation, not a dead "Following" row. Same skeleton
        // (leading mark · label · flex · chevron) so it doesn't jump on first follow.
        <>
          <View style={styles.addBadge}>
            <UserPlus size={15} strokeWidth={icons.strokeWidth} color={colors.paper60} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            Find photographers to follow
          </Text>
        </>
      ) : (
        <>
          {/* Anchored left — never moves as the face count changes. */}
          <Text style={styles.label}>Following</Text>
          <View style={styles.pile}>
            {shown.map((f, i) => (
              <View
                key={f.id}
                // Leftmost face on top; each next tucks behind and to the right.
                // The ink ring is the separator that reads on the dark bg.
                style={[i > 0 && { marginLeft: -OVERLAP }, { zIndex: shown.length - i }]}
              >
                <Avatar uri={f.avatar_url} username={f.username} size={SIZE} ringColor={colors.ink} ringWidth={2} />
              </View>
            ))}
          </View>
        </>
      )}
      {/* Spacer + right-pinned chevron: the affordance is always in the same spot. */}
      <View style={styles.spacer} />
      <ChevronRight size={18} strokeWidth={icons.strokeWidth} color={colors.paper40} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, minHeight: SIZE + 8 },
  label: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper },
  pile: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
  addBadge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.ink2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
