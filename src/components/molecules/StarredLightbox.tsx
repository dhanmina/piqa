/**
 * Fullscreen viewer for the profile's STARRED row (spec §11c) — a private,
 * unframed collection, so it's a plain photo viewer, not a framed print.
 *
 * Starred is a horizontal filmstrip, so the viewer pages left/right through the
 * set (opened at the tapped shot). Dismiss is deliberate — a downward drag that
 * pulls the photo with your finger and fades the backdrop (the iOS/Google Photos
 * feel), plus the close chip — never a bare tap, which closes by accident.
 *
 * Gestures inside a React Native Modal only work when the modal's content has its
 * OWN GestureHandlerRootView (the app has none at the root), so this owns one.
 */
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { imageCacheKey } from '@lib/cache';
import { IconButton } from '@/components/atoms/IconButton';
import { Mono } from '@/components/atoms/Mono';
import { colors, typeScale } from '@/components/tokens';

export type StarItem = { key: string; uri: string | null; fullUri: string | null };

// Past this drag (or a fast flick) the release dismisses; short of it, spring back.
const DISMISS_DISTANCE = 130;

export function StarredLightbox({
  items,
  index,
  onClose,
}: {
  items: StarItem[];
  index: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index);

  const ty = useSharedValue(0);

  // Vertical-only pan: activeOffsetY claims downward drags for dismiss, failOffsetX
  // releases horizontal ones so the paged FlatList scrolls untouched.
  const pan = Gesture.Pan()
    .activeOffsetY([-16, 16])
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        ty.value = withTiming(0, { duration: 160 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(ty.value / (height * 0.6), 0.75),
  }));

  const renderItem = ({ item }: ListRenderItemInfo<StarItem>) => (
    <View style={{ width, height }}>
      <Image
        source={item.fullUri ? { uri: item.fullUri, cacheKey: imageCacheKey(item.fullUri) } : undefined}
        placeholder={item.uri ? { uri: item.uri, cacheKey: imageCacheKey(item.uri) } : undefined}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={120}
      />
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.root, contentStyle]}>
          <FlatList
            data={items}
            keyExtractor={(it) => it.key}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          />
        </Animated.View>
      </GestureDetector>

      <View style={[styles.close, { top: insets.top + 8 }]} pointerEvents="box-none">
        <IconButton icon={X} variant="chrome" accessibilityLabel="Close" onPress={onClose} />
      </View>

      {items.length > 1 && (
        <View style={[styles.counter, { bottom: insets.bottom + 16 }]} pointerEvents="none">
          <Mono size={typeScale.caption} color={colors.paper60}>
            {page + 1} / {items.length}
          </Mono>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(12,11,10,0.96)' },
  close: { position: 'absolute', left: 16, right: 16, flexDirection: 'row' },
  counter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
