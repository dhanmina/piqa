# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Shipping changes

- **OTA a JS/TS change** (no new build): follow `docs/ota-runbook.md` exactly — it
  has the working command and the five traps (env flag, working-tree-not-commits,
  fingerprint matching, channel/branch, two-relaunch apply).
- **Native change → build:** any native module / `app.json` plugin / permission /
  entitlement / `ios`/`android` change needs a new build. See `docs/native-build-plan.md`.
