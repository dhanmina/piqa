import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SymbolView } from 'expo-symbols';
import { NetworkImage } from './NetworkImage';
import { useSharedValue } from 'react-native-reanimated';
import { Carousel, Pagination } from 'react-native-reanimated-carousel';
import { colors, radius, spacing, touchTarget } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CLOSE_ICON = { ios: 'xmark', android: 'close' } as const;
const TRASH_ICON = { ios: 'trash', android: 'delete' } as const;

const iconButtonStyle = {
  width: touchTarget.min,
  height: touchTarget.min,
  margin: spacing.md,
  borderRadius: radius.button,
  backgroundColor: 'rgba(0,0,0,0.55)',
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
  const progress = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex, visible]);

  const canDelete = !!onDelete && !!captureIds && captureIds.length === images.length && images.length > 0;

  function confirmDelete() {
    Alert.alert('Delete this photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete!(activeIndex);
            if (images.length <= 1) onClose();
          } catch (err) {
            console.error('[PhotoViewerModal] delete failed', err);
            Alert.alert('Could not delete photo', 'Check your connection and try again.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}
          onPress={onClose}
        >
          {images.length > 1 ? (
            <View
              style={{
                width: SCREEN_WIDTH,
                height: '70%',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Carousel
                style={{ width: '100%', height: '100%' }}
                data={images}
                defaultIndex={Math.min(initialIndex, images.length - 1)}
                progress={progress}
                onSnapToItem={setActiveIndex}
                renderItem={({ item }) => (
                  <View style={{ width: '100%', height: '100%', alignItems: 'center' }}>
                    <NetworkImage
                      source={{ uri: item }}
                      style={{ width: '86%', height: '100%', borderRadius: 16 }}
                      contentFit="cover"
                    />
                  </View>
                )}
              />
              <Pagination
                progress={progress}
                count={images.length}
                dotStyle={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' }}
                activeDotStyle={{ backgroundColor: '#fff' }}
                containerStyle={{ position: 'absolute', bottom: 12, gap: 6 }}
              />
            </View>
          ) : images[0] ? (
            <NetworkImage source={{ uri: images[0] }} style={{ width: '100%', height: '70%' }} contentFit="contain" />
          ) : null}

          <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
                style={iconButtonStyle}
              >
                <SymbolView name={CLOSE_ICON} size={22} tintColor={colors.textPrimary} />
              </Pressable>

              {canDelete ? (
                <Pressable
                  onPress={confirmDelete}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo"
                  accessibilityState={{ disabled: deleting, busy: deleting }}
                  testID="delete-photo-button"
                  style={[iconButtonStyle, deleting && { opacity: 0.6 }]}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <SymbolView name={TRASH_ICON} size={22} tintColor={colors.textPrimary} />
                  )}
                </Pressable>
              ) : (
                <View style={{ width: touchTarget.min, margin: spacing.md }} />
              )}
            </View>
          </SafeAreaView>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
