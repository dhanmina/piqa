import * as Application from "expo-application";
import * as Updates from "expo-updates";
import PostHog from "posthog-react-native";

/**
 * Product analytics (spec §15 · build plan Phase 0A). PostHog is the measuring
 * stick the whole roadmap gates on — D1/D7/D30 retention + submissions/drop.
 *
 * FAIL-SAFE BY DESIGN: with no `EXPO_PUBLIC_POSTHOG_KEY` set (local dev, or before
 * you create the project) every call here is a silent no-op, so the app behaves
 * identically with or without analytics wired. Init is also wrapped in try/catch —
 * analytics must never crash the app.
 *
 * Set up: create a free project at posthog.com → copy the Project API key →
 * add EXPO_PUBLIC_POSTHOG_KEY (and optionally EXPO_PUBLIC_POSTHOG_HOST for EU) to
 * .env.local, then rebuild (native module — needs a dev/prod build, not Expo Go).
 */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let client: PostHog | null = null;
if (KEY) {
  try {
    client = new PostHog(KEY, {
      host: HOST,
      // Flush after 20 events or 60s — less aggressive than the 10s default
      // to avoid network errors on poor mobile connections.
      flushAt: 20,
      flushInterval: 60_000,
      // Don't capture app lifecycle events (foreground/background) — noisy
      // and not useful for a daily-use photography app.
      captureAppLifecycleEvents: false,
      // Start opted out. Users opt in via the privacy toggle in Settings.
      // This respects GDPR/privacy-by-default and stops all capturing until
      // the user explicitly consents.
      defaultOptIn: false,
    });
    // Suppress noisy PostHog network errors when offline — the SDK throws on
    // every failed flush, which clutters logs with no actionable information.
    const origFlush = client.flush.bind(client);
    client.flush = async () => {
      try { await origFlush(); } catch { /* offline — ignore */ }
    };
    // Super-properties attached to EVERY event:
    // - app_env: exclude your own dev/testing traffic (filter `app_env = prod`).
    // - app_build / ota_update_id / runtime_version: which native build + OTA a
    //   phone is running, so you can verify OTA rollout per user from the dashboard
    //   (no need to show build ids in the UI). "embedded" = no OTA applied yet.
    client.register({
      app_env: __DEV__ ? "dev" : "prod",
      app_build: Application.nativeBuildVersion ?? "unknown",
      ota_update_id: Updates.isEmbeddedLaunch ? "embedded" : (Updates.updateId ?? "unknown"),
      runtime_version: Updates.runtimeVersion ?? "unknown",
    });
  } catch (e) {
    console.warn("[analytics] PostHog init failed; analytics disabled:", e);
  }
}

/**
 * The core-loop events to measure. Keep this list small and stable — these feed
 * the retention gates. Wire `capture(...)` at each point (integration checklist
 * at the bottom of this file).
 */
export type AnalyticsEvent =
  | "shot_entered" // submitted today's Shot (the retention-defining action)
  | "curate_set_completed" // finished a set of 10 picks
  | "reveal_seen" // opened the morning gallery reveal
  | "result_seen" // saw own result on Today
  | "morning_reveal" // played the sequenced morning reveal
  | "gallery_opened" // opened the Gallery tab
  | "activity_opened"; // opened the activity inbox from the Today bell

/** Record a product event. No-op until a PostHog key is configured. */
export function capture(event: AnalyticsEvent, props?: Record<string, unknown>) {
  client?.capture(event, props as Parameters<PostHog["capture"]>[1]);
}

/** Tie events to the signed-in user. Called from SessionProvider on login. */
export function identify(userId: string, props?: Record<string, unknown>) {
  client?.identify(userId, props as Parameters<PostHog["identify"]>[1]);
}

/** Drop identity on sign-out so the next account isn't merged into this one. */
export function resetAnalytics() {
  client?.reset();
}

/** True when a PostHog key is configured and the client initialised. */
export const analyticsEnabled = client !== null;

/**
 * Opt out of analytics capturing. Persists across sessions via PostHog's
 * internal storage. Call from a privacy settings toggle.
 */
export async function optOutAnalytics() {
  await client?.optOut();
}

/** Opt back in after previously opting out. */
export async function optInAnalytics() {
  await client?.optIn();
}

/** Whether the user has opted out of analytics. */
export function hasOptedOut(): boolean {
  return client?.optedOut ?? true;
}

// ---------------------------------------------------------------------------
// Wired (Phase 0A) — capture() call sites:
//   shot_entered         ✓ lib/captureQueue.ts (daily submission row inserted)
//   curate_set_completed ✓ src/app/curate.tsx (a 10-pair set finishes)
//   reveal_seen          ✓ src/app/(tabs)/gallery.tsx (fresh morning reveal)
//   result_seen          ✓ src/app/(tabs)/today.tsx (result card focused)
//   gallery_opened       ✓ src/app/(tabs)/gallery.tsx (tab focus, both sub-tabs)
//   activity_opened      ✓ src/app/activity.tsx (inbox opened from the Today bell)
//   identify/reset       ✓ lib/session.tsx (login / sign-out)
// ---------------------------------------------------------------------------
