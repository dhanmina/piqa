import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { Image, ImageContentFit, ImageStyle } from 'expo-image';
import { colors } from '../lib/theme';

export function NetworkImage({
  source,
  cacheKey,
  style,
  contentFit = 'cover',
  testID,
  accessibilityLabel,
}: {
  source: { uri: string | undefined };
  // The storage path, not the signed URL -- a signed URL's token changes every time
  // it's re-signed, so keying the disk cache on it makes an unchanged photo look
  // like a new one and forces a re-download. Keying on the stable path means a
  // signed-url rotation never busts the cache.
  cacheKey?: string;
  style?: ImageStyle;
  contentFit?: ImageContentFit;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={[style as ViewStyle, styles.container]}>
      <Image
        testID={testID}
        source={{ uri: source.uri, cacheKey }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        transition={200}
        accessibilityLabel={accessibilityLabel}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => console.error('[NetworkImage] load failed', source.uri, e.error)}
      />
      {loading && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.spinner}>
            <ActivityIndicator color={colors.textMuted} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  spinner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
