import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

type ShotCardProps = {
  prompt: string;
  closesAt: Date | string;
  onShoot?: () => void;
  /** Offline is first-class: the shot is safe locally, the button says so. */
  offline?: boolean;
  submitted?: boolean;
  loading?: boolean;
};

/**
 * Deliberately the loudest composition in the app: ink2 card, viewfinder
 * brackets, Clash 24 prompt, mono countdown, the one Primary button.
 */
export function ShotCard({ prompt, closesAt, onShoot, offline = false, submitted = false, loading = false }: ShotCardProps) {
  return (
    <View style={styles.card}>
      <Brackets color={colors.paper}>
        <View style={styles.inner}>
          <Text style={styles.kicker}>Today’s Shot</Text>
          <Text style={styles.prompt}>{prompt}</Text>
          <View style={styles.countdownRow}>
            <Mono size={typeScale.caption} color={colors.paper60}>
              closes in
            </Mono>
            <Countdown until={closesAt} size={typeScale.title} />
          </View>
          {submitted ? (
            <Text style={styles.submittedNote}>In the running ✓</Text>
          ) : offline ? (
            <Button label="Saved — will upload" variant="ghost" disabled />
          ) : (
            <Button label="Shoot it" onPress={onShoot} loading={loading} />
          )}
        </View>
      </Brackets>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    padding: space.gutter,
  },
  inner: {
    padding: space.gutter * 0.6,
    gap: 14,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.caption,
    color: colors.paper60,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  prompt: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
    lineHeight: 30,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  submittedNote: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
  },
});
