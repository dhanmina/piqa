import { useState } from 'react';
import { Image, ImageStyle, LayoutChangeEvent, View } from 'react-native';
import { spacing, radius } from '../lib/theme';

const COLUMNS = 3;
const GAP = spacing.xs;
const FALLBACK_TILE_SIZE = 100;

export function MosaicGrid({ photos }: { photos: string[] }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const tileSize = containerWidth > 0 ? (containerWidth - GAP * (COLUMNS - 1)) / COLUMNS : FALLBACK_TILE_SIZE;
  const tileStyle: ImageStyle = { width: tileSize, height: tileSize };

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
      {photos.map((p, i) => (
        <Image
          key={i}
          testID={`mosaic-tile-${i}`}
          source={{ uri: p }}
          style={[tileStyle, { borderRadius: radius.card }]}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}
