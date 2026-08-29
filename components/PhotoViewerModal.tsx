import { useState } from 'react';
import { Dimensions, FlatList, Image, Modal, Pressable, View } from 'react-native';

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
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setActiveIndex(initialIndex)}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}
        onPress={onClose}
      >
        {images.length > 1 ? (
          <FlatList
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
            onMomentumScrollEnd={(e) => {
              setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
            }}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, height: '70%', justifyContent: 'center' }}>
                <Image source={{ uri: item }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            )}
          />
        ) : images[0] ? (
          <Image source={{ uri: images[0] }} style={{ width: '100%', height: '70%' }} resizeMode="contain" />
        ) : null}

        {images.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 6, position: 'absolute', bottom: 40 }}>
            {images.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === activeIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}
