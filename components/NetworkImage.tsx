import { StyleSheet, View, ViewStyle } from 'react-native';
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
});
