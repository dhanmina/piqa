// Mirrors Metro's automatic .env loading (EXPO_PUBLIC_* vars) so the same
// values are available to Jest, which does not go through Metro's bundler.
// Parsed manually (rather than via Node's process.loadEnvFile) because Jest's
// sandboxed `process` does not reliably propagate env vars set that way.
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Mock react-native-reanimated for Jest (doesn't run in native environment)
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: require('react-native').View,
  },
  useAnimatedStyle: () => ({}),
  useSharedValue: () => ({ value: 0 }),
  withSpring: (value) => value,
  Animated: {
    View: require('react-native').View,
  },
}));
