/**
 * Play Store update nudge. Soft = a dismissible card; forced = no way out (no
 * backdrop dismiss, no Later, no hardware back). Driven by useAppUpdate() off
 * the latest_build / min_build config — pure JS, so it ships over OTA and can
 * nudge an old build onto a new Play release.
 *
 * Shows the target version and an optional changelog so the user knows *why*
 * they should update, not just *that* they should.
 */
import { Download } from 'lucide-react-native';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { colors, fonts, iconStroke, overlay, radius, space, typeScale } from '@/components/tokens';

const SCREEN_W = Dimensions.get('window').width;

type Props = {
  visible: boolean;
  forced: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  /** Target version string from config (e.g. "2.4"). Null when unknown. */
  targetVersion: string | null;
  /** Short changelog blurb from config (e.g. "New gallery grid + faster uploads"). */
  changelog: string | null;
};

export function UpdatePrompt({ visible, forced, onUpdate, onDismiss, targetVersion, changelog }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={forced ? () => {} : onDismiss}
    >
      <View style={styles.scrim}>
        {!forced && <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />}
        <View style={styles.card}>
          {/* Icon row — the download arrow anchors the card visually. */}
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <Download size={20} strokeWidth={iconStroke(20)} color={colors.safelight} />
            </View>
          </View>

          <Text style={styles.title}>
            {forced ? 'Update required' : 'New version available'}
          </Text>

          {targetVersion && (
            <Text style={styles.version}>v{targetVersion}</Text>
          )}

          <Text style={styles.body}>
            {forced
              ? 'This update is required to keep using piqa. Install it to get back in.'
              : changelog
                ? `What's new: ${changelog}`
                : 'Update for the latest fixes and improvements.'}
          </Text>

          <View style={styles.actions}>
            <Button label="Update now" fullWidth onPress={onUpdate} />
            {!forced && (
              <Pressable style={styles.laterButton} onPress={onDismiss}>
                <Text style={styles.laterText}>Later</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: overlay.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.gutter,
  },
  card: {
    width: '100%',
    maxWidth: Math.min(SCREEN_W - 48, 380),
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    padding: 24,
    gap: 12,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 90, 54, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: typeScale.body,
    color: colors.paper,
    textAlign: 'center',
  },
  version: {
    fontFamily: fonts.monoMedium,
    fontSize: typeScale.caption,
    color: colors.safelight,
    textAlign: 'center',
    marginTop: -4,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    color: colors.paper60,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  laterText: {
    fontFamily: fonts.sansMedium,
    fontSize: typeScale.sub,
    color: colors.paper40,
  },
});
