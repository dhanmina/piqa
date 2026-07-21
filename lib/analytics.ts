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
    client = new PostHog(KEY, { host: HOST });
    // Tag every event dev vs prod so the retention baseline can exclude your own
    // dev/testing traffic (filter `app_env = prod` in PostHog).
    client.register({ app_env: __DEV__ ? "dev" : "prod" });
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
  | "gallery_opened"; // opened the Gallery tab

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

// ---------------------------------------------------------------------------
// Integration checklist (Phase 0A) — where to add capture() calls:
//   shot_entered         → lib/captureQueue.ts, when a submission upload succeeds
//   curate_set_completed → src/app/curate.tsx, after a 10-pair set finishes
//   reveal_seen          → src/app/(tabs)/gallery.tsx, when the reveal plays
//   result_seen          → src/app/(tabs)/today.tsx, when the result card shows
//   gallery_opened       → src/app/(tabs)/gallery.tsx, on tab focus
// identify()/resetAnalytics() are already wired in lib/session.tsx.
// ---------------------------------------------------------------------------
