import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const STACK_VISIBLE = 3;

function rotateFrom(length: number, start: number): number[] {
  if (length === 0) return [];
  return Array.from({ length }, (_, i) => (start + i) % length);
}

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
  const [order, setOrder] = useState<number[]>(() => rotateFrom(images.length, initialIndex));

  useEffect(() => {
    if (isVisible) setOrder(rotateFrom(images.length, initialIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  const backDepth = STACK_VISIBLE - 1;
  const backScale = 1 - backDepth * 0.05;
  const backOpacity = 1 - backDepth * 0.25;
  const backTranslateY = backDepth * 14;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const zIndexSV = useSharedValue(STACK_VISIBLE);

  function sendToBack() {
    setOrder((prev) => [...prev.slice(1), prev[0]]);
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    cardOpacity.value = 1;
    zIndexSV.value = STACK_VISIBLE;
  }

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const distance = Math.hypot(e.translationX, e.translationY);
      if (distance > SWIPE_THRESHOLD) {
        zIndexSV.value = 0;
        scale.value = withTiming(backScale, { duration: 220 });
        cardOpacity.value = withTiming(backOpacity, { duration: 220 });
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(backTranslateY, { duration: 220 }, (finished) => {
          if (finished) runOnJS(sendToBack)();
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const topCardStyle = useAnimatedStyle(() => ({
    zIndex: zIndexSV.value,
    opacity: cardOpacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${(translateX.value / SCREEN_WIDTH) * 25}deg` },
    ],
  }));

  const stack = order.slice(0, STACK_VISIBLE).map((imgIndex, depth) => ({ imgIndex, depth }));
  const renderOrder = [...stack].reverse();

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}
          onPress={onClose}
        >
          {images.length > 1 ? (
            <View style={{ width: SCREEN_WIDTH, height: '70%', alignItems: 'center', justifyContent: 'center' }}>
              {renderOrder.map(({ imgIndex, depth }) => {
                const staticStyle = {
                  position: 'absolute' as const,
                  width: '86%' as const,
                  height: '100%' as const,
                  zIndex: STACK_VISIBLE - depth,
                  transform: [{ scale: 1 - depth * 0.05 }, { translateY: depth * 14 }],
                  opacity: 1 - depth * 0.25,
                };

                if (depth === 0) {
                  return (
                    <GestureDetector gesture={pan} key={imgIndex}>
                      <Animated.View style={[staticStyle, topCardStyle]}>
                        <Animated.Image
                          source={{ uri: images[imgIndex] }}
                          style={{ width: '100%', height: '100%', borderRadius: 16 }}
                          resizeMode="cover"
                        />
                      </Animated.View>
                    </GestureDetector>
                  );
                }

                return (
                  <View key={imgIndex} style={staticStyle}>
                    <Animated.Image
                      source={{ uri: images[imgIndex] }}
                      style={{ width: '100%', height: '100%', borderRadius: 16 }}
                      resizeMode="cover"
                    />
                  </View>
                );
              })}
            </View>
          ) : images[0] ? (
            <Animated.Image
              source={{ uri: images[0] }}
              style={{ width: '100%', height: '70%' }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
