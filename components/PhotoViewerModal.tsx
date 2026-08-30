import { Dimensions, Modal, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NetworkImage } from './NetworkImage';
import { useSharedValue } from 'react-native-reanimated';
import { Carousel, Pagination } from 'react-native-reanimated-carousel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function PhotoViewerModal({
  url,
  urls,
  initialIndex = 0,
  visible,
  onClose,
}: {
  url?: string | null;
  urls?: string[];
  initialIndex?: number;
  visible?: boolean;
  onClose: () => void;
}) {
  const images = urls && urls.length ? urls : url ? [url] : [];
  const isVisible = visible ?? images.length > 0;
  const progress = useSharedValue(0);

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
                loop
                progress={progress}
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
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
