import { useState } from 'react';
import { Image, ImageStyle, LayoutChangeEvent, Pressable, View } from 'react-native';
import { spacing, radius } from '../lib/theme';

export type MosaicPhoto = { url: string; capturedAt: string };

const COLUMNS = 3;
const GAP = spacing.xs;
const FALLBACK_TILE_SIZE = 100;

function photoLabel(capturedAt: string): string {
  return `Photo from ${new Date(capturedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

export function MosaicGrid({ photos, onPressPhoto }: { photos: MosaicPhoto[]; onPressPhoto?: (photo: MosaicPhoto) => void }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const tileSize = containerWidth > 0 ? (containerWidth - GAP * (COLUMNS - 1)) / COLUMNS : FALLBACK_TILE_SIZE;
  const tileStyle: ImageStyle = { width: tileSize, height: tileSize, borderRadius: radius.card };

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {photos.map((p, i) => (
        <Pressable
          key={i}
          testID={`mosaic-tile-${i}`}
          onPress={onPressPhoto ? () => onPressPhoto(p) : undefined}
          disabled={!onPressPhoto}
          accessibilityRole={onPressPhoto ? 'button' : 'image'}
          accessibilityLabel={photoLabel(p.capturedAt)}
        >
          <Image source={{ uri: p.url }} style={tileStyle} resizeMode="cover" />
        </Pressable>
      ))}
    </View>
  );
}
