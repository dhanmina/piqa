import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { NetworkImage } from './NetworkImage';

const SLIDE_INTERVAL_MS = 1400;

export function RecapSlideshow({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % photos.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [photos.length]);

  if (photos.length === 0) return null;

  return (
    <View style={{ flex: 1, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface }}>
      <NetworkImage testID={`recap-image-${index}`} source={{ uri: photos[index] }} style={{ flex: 1 }} contentFit="cover" />
    </View>
  );
}
