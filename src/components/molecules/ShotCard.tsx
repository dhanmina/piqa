import { Zap } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Countdown } from '@/components/atoms/Countdown';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { Brackets } from '@/components/molecules/Brackets';
import { colors, fonts, icons, radius, space, typeScale } from '@/components/tokens';

type ShotCardProps = {
  prompt: string;
  closesAt: Date | string;
  onShoot?: () => void;
  /** Quick Draw deadline (drop + config window). Shows a bonus chip until then. */
  quickDrawUntil?: Date | string;
  /** Offline is first-class: the shot is safe locally, the button says so. */
  offline?: boolean;
  submitted?: boolean;
  loading?: boolean;
  /** Optional photography tip for today's Subject (learning loop). */
  hint?: string | null;
};

/**
 * Deliberately the loudest composition in the app: ink2 card, viewfinder
 * brackets, Clash prompt, a big mono countdown, and one full-width Primary.
 * Centered so the whole card reads as a single focal hero.
 */
export function ShotCard({
  prompt,
  closesAt,
  onShoot,
  quickDrawUntil,
  offline = false,
  submitted = false,
  loading = false,
  hint,
}: ShotCardProps) {
  const [quickDrawOver, setQuickDrawOver] = useState(false);
  const showQuickDraw =
    !submitted &&
    quickDrawUntil !== undefined &&
    !quickDrawOver &&
    Date.now() < new Date(quickDrawUntil).getTime();

  return (
    <View style={styles.card}>
      <Brackets color={colors.paper} style={styles.brackets}>
        <View style={styles.inner}>
          <Text style={styles.kicker}>Today’s Shot</Text>
          <Text style={styles.prompt} numberOfLines={3}>
            {prompt}
          </Text>
          {hint ? (
            <Text style={styles.hint} numberOfLines={2}>
              {hint}
            </Text>
          ) : null}

          <View style={styles.countdownBlock}>
            <Mono size={typeScale.caption} color={colors.paper60}>
              CLOSES IN
            </Mono>
            <Countdown until={closesAt} size={typeScale.display} />
          </View>

          {/* Urgency is a reward, never a punishment — a bonus, not a penalty.
              No "+10": XP is quiet (spec §10) and never shown landing, so promising
              a figure here would be a receipt the app never issues. The chip is the
              promise; the Quick Draw mark on the submitted shot is the receipt. */}
          {showQuickDraw && (
            <View style={styles.quick}>
              <Zap size={12} strokeWidth={icons.strokeWidth} color={colors.safelight} />
              <Mono size={typeScale.tabLabel} weight="medium" color={colors.safelight}>
                QUICK DRAW
              </Mono>
              <Mono size={typeScale.tabLabel} color={colors.safelight}>
                ·
              </Mono>
              <Countdown until={quickDrawUntil!} size={typeScale.tabLabel} color={colors.safelight} onDone={() => setQuickDrawOver(true)} />
            </View>
          )}

          <View style={styles.action}>
            {submitted ? (
              <Text style={styles.submittedNote}>In the running</Text>
            ) : offline ? (
              <Button label="Saved · will upload" variant="ghost" disabled fullWidth />
            ) : (
              <Button label="Shoot it" onPress={onShoot} loading={loading} fullWidth />
            )}
          </View>
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
  brackets: {
    alignSelf: 'stretch',
  },
  inner: {
    paddingHorizontal: space.gutter * 0.5,
    paddingVertical: space.gutter * 0.5,
    alignItems: 'center',
    gap: 16,
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
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: typeScale.caption,
    color: colors.paper60,
    lineHeight: typeScale.caption * 1.4,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  countdownBlock: {
    alignItems: 'center',
    gap: 4,
  },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 54, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: 2,
  },
  submittedNote: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.body,
    color: colors.paper,
    textAlign: 'center',
  },
});
