import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { Image, ImageContentFit, ImageStyle } from 'expo-image';
import { colors } from '../lib/theme';

export function NetworkImage({
  source,
  style,
  contentFit = 'cover',
  testID,
  accessibilityLabel,
}: {
  source: { uri: string | undefined };
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
        source={source}
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
