import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../lib/theme';
import { Button } from './Button';

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  confirmLoadingLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  confirmLoadingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        }}
        onPress={loading ? undefined : onCancel}
      >
        <Pressable onPress={() => {}} accessibilityViewIsModal accessibilityRole="alert">
          <SafeAreaView
            edges={['bottom']}
            style={{
              backgroundColor: colors.surfaceRaised,
              borderTopWidth: 1,
              borderColor: colors.border,
              borderTopLeftRadius: radius.card,
              borderTopRightRadius: radius.card,
            }}
          >
            <View style={{ padding: spacing.lg }}>
              <Text style={{ ...type.title, color: colors.textPrimary }}>{title}</Text>
              {message ? (
                <Text style={{ ...type.body, color: colors.textMuted, marginTop: spacing.xs }}>{message}</Text>
              ) : null}

              <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                <Button label={cancelLabel} onPress={onCancel} disabled={loading} variant="primary" />
                <Button
                  label={confirmLabel}
                  loadingLabel={confirmLoadingLabel}
                  onPress={onConfirm}
                  disabled={loading}
                  loading={loading}
                  variant="secondary"
                />
              </View>
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
