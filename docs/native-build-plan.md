# Native-once, then OTA-forever

The strategy for spending EAS build credits efficiently: **front-load every native
dependency we'll plausibly need into one build, then ship everything else over OTA.**

## The rule
- **Forces a native build:** a new native module, an `app.json` plugin / permission /
  entitlement change, or anything touching `ios/` / `android/`.
- **Ships over OTA (no build):** JS/TS, screens, RPCs + SQL migrations, copy, and any
  config delivered through `EXPO_PUBLIC_*` env (read at JS runtime).

Only a *new native dependency* should ever trigger another build.

## What went into "the one build" (2026-07-21, preview/Android)
| Added | For |
|---|---|
| ~~`expo-media-library`~~ (removed) | Save-to-device, deferred (see note) |
| `@react-native-google-signin/google-signin` (+ plugin) | Google sign-in (Android) |
| `expo-apple-authentication` (+ plugin, `ios.usesAppleSignIn`) | Apple sign-in (iOS, future) |
| `expo-store-review` | Growth-phase app-store rating prompt (Phase 4) |

All of Phase 1 was already OTA'd onto the previous binary; this build simply bakes it
in natively so *new* installs get it without the cold-launch OTA dance.

## Media permissions (Play policy)
piqa captures in-app and never reads the user's gallery, so it must NOT declare
`READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` (Google's Photo & Video Permissions policy).
Steps taken: removed `expo-media-library` (was unused, pulled in the video permission),
`android.blockedPermissions` strips READ_MEDIA_IMAGES/VIDEO + ACCESS_MEDIA_LOCATION,
and the profile-picture picker uses the OS photo picker (no permission). When
save-to-device is actually built, add media-library back with add-only (write) access.

## Deliberately NOT in the build (kept efficient)
- **Sentry** — the `@sentry/react-native` native module is *already* in the binary.
  Native crash capture only needs `Sentry.init({ dsn })`, and the DSN comes from
  `EXPO_PUBLIC_SENTRY_DSN` at JS runtime → **wire it via OTA env, no build.** (Re-adding
  the config plugin — for readable source-maps — is the thing that broke the build
  before; defer it to some future build with a `SENTRY_AUTH_TOKEN` EAS secret.)
- **Image moderation** — do it **server-side** (a Supabase Edge Function calling a
  moderation API), not native TensorFlow. Serverless → no build, ever.
- **Payments / IAP** — deferred by design. Needs App Store / Play product setup and
  will earn its *own* build when the revenue phase starts.

## After this build
- New runtime **fingerprint** → future `eas update`s target it automatically.
- Social sign-in ships **disabled**; the native modules are present, so turning the
  buttons on later (with Google/Apple credentials via env) is a pure **OTA**.
- Save-to-device UI likewise wires up over OTA — the module is already in the binary.
