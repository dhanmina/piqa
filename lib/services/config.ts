import { supabase } from "./supabase";

/**
 * Every threshold lives in the config table (spec §13) — never hardcoded.
 * Values are cached for the session; call refreshConfig() to force a refetch.
 * The FALLBACKS below are used only when the table is unreachable (offline
 * cold start) and mirror the seeded defaults.
 */
const FALLBACKS = {
  gallery_pct: 20,
  gallery_min: 10,
  gallery_max: 50,
  vote_cap: 50,
  votes_per_set: 10,
  quorum: 8,
  beta_mode: true,
  beta_gallery_all_below: 15,
  vote_min_interval_s: 2,
  elo_k: 32,
  elo_start: 1000,
  bt_shrink_c: 5,
  quick_draw_minutes: 30,
  stars_per_month: 5,
  xp_daily_cap: 250,
  reports_quarantine_at: 3,
  nsfw_threshold: 0.7,
  // Play Store update nudge (client-side, OTA-shippable). Compare the installed
  // Android versionCode against these: below latest_build -> soft nudge, below
  // min_build -> forced. 0 (the fallback) never nags, so an offline cold start or
  // an unset value is always safe.
  latest_build: 0,
  min_build: 0,
  // Optional version metadata shown in the update prompt. Strings so they can be
  // anything ("2.4", "2.4.1-beta", etc.). Empty/falsy = hidden.
  update_version: "",
  update_changelog: "",
} as const;

export type ConfigKey = keyof typeof FALLBACKS;

let cache: Record<string, unknown> | null = null;
let inflight: Promise<Record<string, unknown>> | null = null;

async function loadConfig(): Promise<Record<string, unknown>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.from("config").select("key,value");
      inflight = null;
      if (error || !data) return { ...FALLBACKS };
      cache = Object.fromEntries(data.map((row) => [row.key, row.value]));
      return cache!;
    })();
  }
  return inflight;
}

export async function getConfig<K extends ConfigKey>(key: K): Promise<(typeof FALLBACKS)[K]> {
  const cfg = await loadConfig();
  const value = cfg[key];
  return (value ?? FALLBACKS[key]) as (typeof FALLBACKS)[K];
}

export async function refreshConfig(): Promise<void> {
  cache = null;
  await loadConfig();
}
