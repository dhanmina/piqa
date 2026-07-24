const {
  withAndroidManifest,
} = require('expo/config-plugins');

/**
 * Declares camera and microphone as NOT required in the AndroidManifest so
 * Google Play doesn't filter out devices that lack these hardware features
 * (tablets, Chromebooks, some budget phones). Piqa degrades gracefully — you
 * can view the gallery and profile without a camera.
 *
 * Without this, the CAMERA permission alone tells Play Store to assume the
 * camera is required, blocking installs on device without one.
 */
module.exports = function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest['uses-feature']) manifest['uses-feature'] = [];

    const features = [
      { 'android:name': 'android.hardware.camera', 'android:required': 'false' },
      { 'android:name': 'android.hardware.camera.autofocus', 'android:required': 'false' },
      { 'android:name': 'android.hardware.microphone', 'android:required': 'false' },
    ];

    for (const attrs of features) {
      const name = attrs['android:name'];
      // Skip if already declared (e.g. by expo-camera).
      const existing = manifest['uses-feature'].find(
        (f) => f.$?.['android:name'] === name,
      );
      if (existing) {
        // Override required → false even if another plugin declared it.
        existing.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({ $: attrs });
      }
    }

    return config;
  });
};
