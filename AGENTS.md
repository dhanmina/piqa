# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Shipping changes

**Order (never reorder): commit → migration → OTA → verify.**
1. **Commit first** and get `git status` clean — `eas update` publishes the WORKING
   TREE, not the last commit, so uncommitted/WIP code leaks to prod otherwise.
2. **Apply DB migrations to prod** (`supabase db push --linked`) — server before
   client, since the new bundle may read new columns/RPCs. Keep them backward-compatible.
3. **OTA** the JS change, then **verify** (channel/runtime match + two-relaunch).

- **OTA a JS/TS change** (no new build): follow `docs/ota-runbook.md` exactly — it
  has the working command and the five traps (env flag, working-tree-not-commits,
  fingerprint matching, channel/branch, two-relaunch apply).
- **Native change → build:** any native module / `app.json` plugin / permission /
  entitlement / `ios`/`android` change needs a new build. See `docs/native-build-plan.md`.
