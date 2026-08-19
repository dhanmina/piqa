/**
 * Report a photo (spec §12) — shared by the fullscreen viewer and curation.
 *
 * Two steps on purpose: reassure and pick a reason, then confirm. A single tap
 * shouldn't file a report, because three distinct reports quarantine a photo, so
 * a mistap has real weight. Reporting is anonymous; the shooter never learns who.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REPORT_REASONS, reportSubmission } from '@lib/services/moderation';
import { Button } from '@/components/atoms/Button';
import { Sheet } from '@/components/molecules/Sheet';
import { colors, fonts, space, typeScale } from '@/components/tokens';

type Reason = (typeof REPORT_REASONS)[number];

type Props = {
  visible: boolean;
  /** The submission being reported. Null just keeps the sheet inert while closed. */
  submissionId: string | null;
  onClose: () => void;
  /** Fired after the report lands, so the host can toast + close/advance. */
  onReported: () => void;
};

export function ReportSheet({ visible, submissionId, onClose, onReported }: Props) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);

  // Always reopen on the reason list, never a stale confirm.
  useEffect(() => {
    if (!visible) setReason(null);
  }, [visible]);

  const close = () => {
    setReason(null);
    onClose();
  };

  const submit = async () => {
    if (!submissionId || !reason) return;
    setBusy(true);
    await reportSubmission(submissionId, reason.value);
    setBusy(false);
    setReason(null);
    onReported();
  };

  return (
    <Sheet visible={visible} onClose={close} title={reason ? 'Report this photo?' : 'Report this photo'}>
      {!reason ? (
        <>
          <Text style={styles.intro}>Reporting is anonymous. Pick what&apos;s wrong and we&apos;ll take a look.</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r.value} accessibilityRole="button" style={styles.reasonRow} onPress={() => setReason(r)}>
              <Text style={styles.reasonLabel}>{r.label}</Text>
              <Text style={styles.reasonDesc}>{r.desc}</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <View style={styles.confirmBody}>
          <Text style={styles.confirmReason}>{reason.label}</Text>
          <Text style={styles.intro}>
            We&apos;ll review this photo. It won&apos;t show up for you again, and the shooter won&apos;t know who reported it.
          </Text>
          <Button label="Submit report" variant="primary" fullWidth loading={busy} onPress={() => void submit()} />
          <Pressable accessibilityRole="button" style={styles.backRow} disabled={busy} onPress={() => setReason(null)}>
            <Text style={styles.backText}>Pick a different reason</Text>
          </Pressable>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.sans, fontSize: typeScale.sub, lineHeight: typeScale.sub * 1.4, color: colors.paper60, marginBottom: space.xxsPlus },
  reasonRow: { gap: space.hair, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.ink },
  reasonLabel: { fontFamily: fonts.sansMedium, fontSize: typeScale.body, color: colors.paper },
  reasonDesc: { fontFamily: fonts.sans, fontSize: typeScale.caption, color: colors.paper60 },
  confirmBody: { gap: 12 },
  confirmReason: { fontFamily: fonts.sansSemiBold, fontSize: typeScale.title, color: colors.paper },
  backRow: { alignItems: 'center', paddingVertical: space.xsPlus },
  backText: { fontFamily: fonts.sansMedium, fontSize: typeScale.sub, color: colors.paper60 },
});
