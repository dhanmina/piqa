/**
 * Play Store update nudge. Soft = a dismissible card (Update / Later); forced =
 * the same card without a way out (no backdrop dismiss, no Later, no hardware
 * back). Driven by useAppUpdate() off the `latest_build` / `min_build` config —
 * pure JS, so it ships over OTA and can nudge an old build onto a new Play release.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { displayFamily } from '@/components/fonts';
import { colors, fonts, radius, space, typeScale } from '@/components/tokens';

type Props = {
  visible: boolean;
  forced: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
};

export function UpdatePrompt({ visible, forced, onUpdate, onDismiss }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Forced: swallow the Android hardware back so it can't be escaped.
      onRequestClose={forced ? () => {} : onDismiss}
    >
      <View style={styles.backdrop}>
        {/* Soft: tap outside to dismiss. Forced: the backdrop does nothing. */}
        {!forced && <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss" />}
        <View style={styles.card}>
          <Text style={styles.title}>A new version of Piqa is here</Text>
          <Text style={styles.body}>
            {forced
              ? 'Update to keep using Piqa. It only takes a moment.'
              : 'Update on the Play Store for the latest fixes and features.'}
          </Text>
          <View style={styles.actions}>
            <Button label="Update" onPress={onUpdate} />
            {!forced && <Button label="Later" variant="text" onPress={onDismiss} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,11,10,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.gutter,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.ink2,
    borderRadius: radius.card,
    padding: space.gutter,
    gap: 10,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: typeScale.title,
    color: colors.paper,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: typeScale.sub,
    lineHeight: typeScale.sub * 1.4,
    color: colors.paper60,
  },
  actions: { gap: 4, marginTop: 8 },
});
