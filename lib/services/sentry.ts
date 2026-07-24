import * as Sentry from "@sentry/react-native";

/**
 * Crash & error monitoring (build plan Phase 0). Sentry is the safety net for the
 * offline queue + budget-Android reality — it catches JS errors, unhandled
 * rejections, and native crashes.
 *
 * FAIL-SAFE: with no `EXPO_PUBLIC_SENTRY_DSN` set, Sentry never initialises and
 * `wrapRoot` is a passthrough, so the app runs identically without it.
 *
 * Set up: create a project at sentry.io (React Native) → copy the DSN → add
 * EXPO_PUBLIC_SENTRY_DSN to .env.local + the eas.json build profiles, then rebuild
 * (native module — needs a dev/prod build). Readable stack traces (source-map
 * upload) are a later step: set SENTRY_AUTH_TOKEN + org/project on the config
 * plugin, out of scope for first-light crash reporting.
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "dev" : "prod",
    // Alpha: crashes/errors are the point — keep performance tracing light and
    // never attach PII by default.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const sentryEnabled = DSN !== undefined && DSN !== "";

/**
 * Wrap the root component so Sentry captures render/runtime errors and ties them
 * to sessions. No-op passthrough when no DSN is configured.
 */
export function wrapRoot<T>(RootComponent: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return DSN ? (Sentry.wrap(RootComponent as any) as T) : RootComponent;
}
