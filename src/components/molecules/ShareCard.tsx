import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FrameId, PhotoStatus } from '@lib/frames';
import { Brandmark } from '@/components/atoms/Brandmark';
import { Mono } from '@/components/atoms/Mono';
import { displayFamily } from '@/components/fonts';
import { FramedPhoto } from '@/components/molecules/FramedPhoto';
import { colors, typeScale } from '@/components/tokens';

type ShareCardProps = {
  photoUri?: string | null;
  dayNumber: number;
  frameId?: FrameId;
  status?: PhotoStatus;
  shooter: string;
  /** The day's theme/brief, shown as the eyebrow when known. */
  theme?: string | null;
  /** Capture width in points; the snapshot renders at width × device pixel ratio. */
  width?: number;
};

/**
 * The shareable "piqa print" — a poster snapshotted with react-native-view-shot
 * (see lib/share). The framed print is already the whole brand object (its rail
 * carries PIQA · the day · the maker's dot · the crown), so the card wraps it as
 * tight as possible: a theme eyebrow and a single credit line (shooter · mark)
 * sharing the print's left edge — no lone floating elements, no dead air. PotD is
 * signalled by the gold theme + the crown on the rail, not a separate line.
 *
 * A print, so radius 0 (spec §11b); full-bleed ink = a clean, alpha-free image.
 */
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { photoUri, dayNumber, frameId = 'default', status = null, shooter, theme, width = 360 },
  ref,
) {
  const isCrown = status === 'crown';
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width }]}>
      {theme ? (
        <Mono size={typeScale.caption} weight="medium" color={isCrown ? colors.crown : colors.paper60} style={styles.theme}>
          {theme.toUpperCase()}
        </Mono>
      ) : null}

      <FramedPhoto photoUri={photoUri} dayNumber={dayNumber} frameId={frameId} status={status} style={styles.print} />

      <View style={styles.credit}>
        <Text style={styles.shooter} numberOfLines={1}>
          @{shooter}
        </Text>
        <Brandmark size={18} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, padding: 16, gap: 12 },
  print: { alignSelf: 'stretch' },
  theme: { letterSpacing: 1.8 },
  credit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  shooter: { fontFamily: displayFamily, fontSize: typeScale.body, color: colors.paper, flexShrink: 1 },
});
