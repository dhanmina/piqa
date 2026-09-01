const { withAndroidColors, withAndroidStyles } = require('expo/config-plugins');

// react-native-screens switches tabs via native Fragment attach/detach. AppTheme
// had no android:windowBackground, so it fell through to AppCompat's DayNight
// default (white in light mode) -- that raw Activity window paints for a frame
// on every tab switch, showing as a white flash. Pin it to the same dark ground
// as lib/theme.ts colors.background so that gap reads as the app's own bg.
const BACKGROUND_COLOR = '#0A0A0A';

module.exports = function withAndroidWindowBackground(config) {
  config = withAndroidColors(config, (config) => {
    config.modResults.resources.color = config.modResults.resources.color ?? [];
    const existing = config.modResults.resources.color.find((c) => c.$.name === 'piqaWindowBackground');
    if (existing) {
      existing._ = BACKGROUND_COLOR;
    } else {
      config.modResults.resources.color.push({ $: { name: 'piqaWindowBackground' }, _: BACKGROUND_COLOR });
    }
    return config;
  });

  config = withAndroidStyles(config, (config) => {
    const appTheme = config.modResults.resources.style?.find((s) => s.$.name === 'AppTheme');
    if (appTheme) {
      appTheme.item = appTheme.item ?? [];
      const existing = appTheme.item.find((i) => i.$.name === 'android:windowBackground');
      if (existing) {
        existing._ = '@color/piqaWindowBackground';
      } else {
        appTheme.item.push({ $: { name: 'android:windowBackground' }, _: '@color/piqaWindowBackground' });
      }
    }
    return config;
  });

  return config;
};
