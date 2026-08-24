import { View } from 'react-native';

export default function CameraActionPlaceholder() {
  // Never actually rendered — tabPress above always intercepts and redirects to /capture.
  return <View />;
}
