# OTA runbook (eas update)

How to ship a JS/TS change to installed apps **without a new build**. Read
`native-build-plan.md` first for the native-vs-OTA rule. This file is the exact,
tested procedure — including the traps that have actually bitten us.

## TL;DR — the command that works

```bash
eas update \
  --branch production \
  --platform android \
  --environment production \
  --message "what changed, in plain words" \
  --non-interactive
```

Then the app applies it on the **second** relaunch (see "How it reaches phones").

## Order of operations (do NOT reorder)

**Always: commit → migration → OTA → verify.**

1. **Commit first.** `eas update` publishes the working tree (trap #2), so commit
   your change and get `git status` clean BEFORE publishing. This guarantees what
   ships == a known commit, and stops WIP / another session's edits leaking to prod.
2. **Apply DB migrations to prod next** (if the change has any): `supabase db push
   --linked`. Server before client — a newly OTA'd bundle may read a new column /
   RPC, so the DB must have it first. Keep migrations backward-compatible so they
   don't break the OLD bundle still running on phones until they update.
3. **Then OTA** (`eas update …`) — ships the now-clean tree to phones.
4. **Verify** (channel/runtime match) and do the two-relaunch check.

Why commit before OTA and not after: if you OTA first and the tree had uncommitted
junk, it is already in production before anyone reviewed it. Commit is the gate.

## What can and cannot ship over OTA

- **OTA-able:** JS/TS, React components, screens, copy, styles, images already in
  the bundle, and anything read from `EXPO_PUBLIC_*` env at JS runtime. Supabase
  RPCs / SQL migrations are "OTA-class" too (server-side; reach every build at once).
- **NOT OTA-able — needs a build:** any native module, an `app.json` plugin /
  permission / entitlement change, `googleServicesFile`, notification icon, icons,
  splash, or anything touching `ios/` / `android/`. These change the **runtime
  fingerprint**, so an OTA built from that state targets a fingerprint no installed
  app has (see the fingerprint trap).

## The five traps (all have bitten us)

1. **`--environment` is REQUIRED in `--non-interactive`.** Without it the publish
   errors out. It also injects the server-side env vars (Supabase URL/key). If you
   OTA WITHOUT the right environment, the bundle inlines an undefined Supabase URL
   and the app **bricks on the splash screen**. Always pass `--environment production`
   for the production branch (or `preview` for preview).

2. **`eas update` publishes your WORKING TREE, not the last commit.** Uncommitted /
   WIP / another session's edits go to production silently. **Always run
   `git status` first and make sure it is clean** (or that you have reviewed exactly
   what is uncommitted). Commit before you publish.

3. **An OTA only reaches builds with the SAME runtime fingerprint.** Each native
   build has a fingerprint (`runtimeVersion: { policy: "fingerprint" }`). `eas
   update` computes the current tree's fingerprint and only devices on a build with
   that exact fingerprint receive it. You cannot reliably force a mismatched
   fingerprint by hand — if the tree has drifted (e.g. `google-services.json` was
   added), the publish lands on a fingerprint no build has and reaches nobody.
   **Verify the runtime after publishing** (below).

4. **Channel → branch must match the build's channel.** Builds are pinned to a
   channel (`eas.json` → the profile's `channel`). `--branch production` reaches a
   build on the `production` channel only if the production channel points at the
   production branch (it does here). Check with `eas channel:view production`.

5. **It applies on the SECOND relaunch, not the first.** expo-updates checks on
   launch, downloads in the background, and applies on the *next* launch. So the
   canary flips only after: kill+reopen (downloads) → kill+reopen again (applies).
   Needs network. Backgrounding does not count — it must be a full kill.

## Verify after publishing

```bash
# Does the production channel point at the runtime you just published?
eas channel:view production        # -> Branch: production, Runtime Version: <fp>

# What runtime is the target build on? (must equal the runtime above)
eas build:list --platform android --limit 1 --non-interactive   # -> Runtime Version + Version code
```

If the published runtime == the build's runtime == the channel's runtime, it will
land. In-app confirmation: Settings → ABOUT → **Build** row (admin-only) shows
`embedded` until an OTA is applied, then the 8-char update id (e.g. `019f8d2c`).

## Current facts (update if they change)

- EAS project id: `695fe1c2-f6a3-485f-b8b9-1b0314618f44`, slug `piqa`.
- Channels: `production` (live build), `preview`.
- Prod Supabase ref: `eppbhvhmyibhyhilombx` (region PH). The `production` EAS
  environment holds `EXPO_PUBLIC_SUPABASE_URL/KEY` + `EXPO_PUBLIC_POSTHOG_KEY`.
- Fingerprints seen: build 5 = `885a2f98…`, build 6 (FCM) = `b166691a…`. Only the
  current build's fingerprint receives new OTAs.

## Rollback

`eas update` is forward-only (you publish a newer update). To "roll back", publish
the previous good state again (check it out, confirm `git status`, republish), or
use `eas update:republish --group <old-group-id>` to re-point the branch at an
earlier update group. Find group ids with `eas channel:view production` /
`eas update:list --branch production`.
