import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Pressable } from 'react-native-gesture-handler';
import { NetworkImage } from './NetworkImage';
import { ConfirmDialog } from './ConfirmDialog';
import { Snackbar, SNACKBAR_DURATION_MS } from './Snackbar';
import { CloseIcon, TrashIcon } from './Icons';
import { Carousel } from 'react-native-reanimated-carousel';
import { colors, radius, spacing, touchTarget, type, PHOTO_ASPECT_RATIO } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLATE_WIDTH = SCREEN_WIDTH - spacing.md * 2;

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

const CarouselPhoto = memo(function CarouselPhoto({ uri }: { uri: string }) {
  return (
    <NetworkImage
      source={{ uri }}
      style={{ width: '100%', aspectRatio: PHOTO_ASPECT_RATIO }}
      contentFit="cover"
    />
  );
});

const iconButtonStyle = {
  width: touchTarget.min,
  height: touchTarget.min,
  margin: spacing.md,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

export function PhotoViewerModal({
  url,
  urls,
  initialIndex = 0,
  visible,
  onClose,
  captureIds,
  onDelete,
}: {
  url?: string | null;
  urls?: string[];
  initialIndex?: number;
  visible?: boolean;
  onClose: () => void;
  captureIds?: string[];
  onDelete?: (index: number) => Promise<void>;
}) {
  const images = urls && urls.length ? urls : url ? [url] : [];
  const isVisible = visible ?? images.length > 0;
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex, visible]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const canDelete = !!onDelete && !!captureIds && captureIds.length === images.length && images.length > 0;

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await onDelete!(activeIndex);
      setConfirmVisible(false);
      setSnackbarMessage('Photo deleted');
      if (images.length <= 1) {
        // Hold the viewer open just long enough for the confirmation to register
        // before it closes, instead of yanking the screen away mid-message.
        closeTimer.current = setTimeout(onClose, SNACKBAR_DURATION_MS);
      }
    } catch (err) {
      console.error('[PhotoViewerModal] delete failed', err);
      setConfirmVisible(false);
      Alert.alert('Could not delete photo', 'Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
          onPress={onClose}
        >
          <View
            style={{
              width: PLATE_WIDTH,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              overflow: 'hidden',
            }}
          >
            {images.length > 1 ? (
              <Carousel
                style={{ width: '100%', aspectRatio: PHOTO_ASPECT_RATIO }}
                data={images}
                renderWindowSize={3}
                defaultIndex={Math.min(initialIndex, images.length - 1)}
                onSnapToItem={setActiveIndex}
                renderItem={({ item }) => <CarouselPhoto uri={item} />}
              />
            ) : images[0] ? (
              <CarouselPhoto uri={images[0]} />
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  ...type.caption,
                  fontSize: 10.5,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: colors.textFaint,
                }}
              >
                Photo
              </Text>
              <Text style={{ ...type.data, color: colors.textPrimary }}>
                {pad(activeIndex + 1)} / {pad(images.length)}
              </Text>
            </View>
          </View>

          <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
                style={({ pressed }) => [iconButtonStyle, pressed && { opacity: 0.6 }]}
              >
                <CloseIcon size={22} color={colors.textPrimary} />
              </Pressable>

              {canDelete ? (
                <Pressable
                  onPress={() => setConfirmVisible(true)}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo"
                  accessibilityState={{ disabled: deleting, busy: deleting }}
                  testID="delete-photo-button"
                  style={({ pressed }) => [iconButtonStyle, (deleting || pressed) && { opacity: 0.6 }]}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <TrashIcon size={22} color={colors.textPrimary} />
                  )}
                </Pressable>
              ) : (
                <View style={{ width: touchTarget.min, margin: spacing.md }} />
              )}
            </View>
          </SafeAreaView>

          <SafeAreaView pointerEvents="none" edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <Snackbar message={snackbarMessage} onDismiss={() => setSnackbarMessage(null)} />
          </SafeAreaView>
        </Pressable>
      </GestureHandlerRootView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete this photo?"
        message="This cannot be undone."
        confirmLabel="Delete"
        confirmLoadingLabel="Deleting…"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmVisible(false)}
        loading={deleting}
      />
    </Modal>
  );
}
