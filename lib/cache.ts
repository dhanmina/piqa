import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./services/supabase";

/**
 * Tiny client cache so screens don't refetch the world on every focus (tab
 * screens stay mounted, so a naive focus-effect hammers the RPC + storage
 * signing endpoints on every visit — costly at any real user count).
 *
 * Two layers:
 *   1. Keyed RPC cache — TTL freshness + in-flight dedupe + cross-hook sharing.
 *      Multiple hook instances on the same key (e.g. get_home_state in TabBar,
 *      Today, and Camera) collapse into ONE fetch and share the result.
 *   2. Signed-URL cache — a private thumb signs once and is reused everywhere
 *      until just before it expires, instead of re-signing per screen/tile.
 */

// ---------------------------------------------------------------------------
// 1. Keyed RPC cache
// ---------------------------------------------------------------------------
type Entry = { value: unknown; at: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
export const errors = new Map<string, boolean>(); // last fetch for a key failed
export const subscribers = new Map<string, Set<() => void>>();
// Bumped every time a key is invalidated. A fetch captures the generation at its
// start and only commits its result if the generation still matches — so a fetch
// that was already in flight when a write invalidated the key (its data is now
// stale) is discarded instead of being deduped onto or clobbering the fresh read.
const generation = new Map<string, number>();

function bumpGeneration(key: string) {
  generation.set(key, (generation.get(key) ?? 0) + 1);
}

export function emit(key: string) {
  subscribers.get(key)?.forEach((fn) => fn());
}

// --- disk persistence (survive cold starts) --------------------------------
// The RPC store is mirrored to AsyncStorage so a relaunch paints last-known data
// instantly (stale-while-revalidate) instead of a skeleton, and does one quiet
// background revalidate instead of a burst of cold fetches. Only RPC payloads
// persist — never signed URLs, which expire. Wiped on sign-out.
const PERSIST_PREFIX = "rpccache:";
let hydrated = false;

function persistEntry(key: string, entry: Entry) {
  void AsyncStorage.setItem(PERSIST_PREFIX + key, JSON.stringify(entry)).catch(() => {});
}

/**
 * Load persisted entries into memory once, at startup, before the first screen
 * mounts. Never clobbers a value already fetched fresh this session.
 */
export async function hydrateCache(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PERSIST_PREFIX));
    if (keys.length === 0) return;
    // Batch into a single native bridge call (multiGet) instead of N individual
    // getItem calls. On Android each getItem is a separate SQLite query, so this
    // is a meaningful startup-speed win at scale.
    const pairs = await AsyncStorage.multiGet(keys);
    if (__DEV__) console.log(`[cache] hydrate: ${pairs.length} keys from disk`);
    for (const [pk, raw] of pairs) {
      if (!raw || !pk) continue;
      const key = pk.slice(PERSIST_PREFIX.length);
      if (store.has(key)) continue; // a live fetch already won this session
      try {
        store.set(key, JSON.parse(raw) as Entry);
        emit(key);
      } catch {
        /* corrupt entry — skip it */
      }
    }
  } catch {
    /* storage unavailable — run memory-only */
  }
}

/** Wipe cache (memory + disk) on sign-out so the next account starts clean. */
export async function clearPersistedCache(): Promise<void> {
  const keys = [...store.keys()];
  // Bump every in-flight key's generation so a fetch from the old session can't
  // land after sign-out and repopulate the cache with the previous user's data.
  for (const key of new Set([...store.keys(), ...inflight.keys()])) bumpGeneration(key);
  store.clear();
  inflight.clear();
  errors.clear();
  keys.forEach(emit);
  try {
    const pk = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PERSIST_PREFIX));
    await Promise.all(pk.map((k) => AsyncStorage.removeItem(k).catch(() => {})));
  } catch {
    /* best-effort */
  }
}

export function peek<T>(key: string): { value: T; at: number } | undefined {
  return store.get(key) as { value: T; at: number } | undefined;
}

/** Drop a key so the next read refetches (e.g. after a submission lands). */
export function invalidate(key: string) {
  store.delete(key);
  // Any fetch already in flight was issued before this write, so its result is
  // stale. Drop the dedupe handle so the next fetchKey issues a genuinely fresh
  // request, and bump the generation so the stale one is discarded when it lands
  // rather than clobbering the fresh data. Without this a submission's refetch
  // deduped onto the pre-submission fetch and Today needed a manual pull-to-refresh.
  inflight.delete(key);
  bumpGeneration(key);
  void AsyncStorage.removeItem(PERSIST_PREFIX + key).catch(() => {});
  emit(key);
}

/**
 * Force the next read to fetch fresh — WITHOUT dropping the cached value. Same
 * generation bump + inflight clear as invalidate() (so a fresh request is issued
 * and any pre-write fetch in flight is discarded), but the current value stays in
 * the store, so the UI keeps showing it while revalidating instead of blanking to
 * a loading state. Use when the on-screen data is still usable and a hard flash
 * would be worse than briefly-stale data (e.g. home state after a shot uploads).
 */
export function revalidate(key: string) {
  inflight.delete(key);
  bumpGeneration(key);
  emit(key);
}

/**
 * Drop every key under a prefix. Needed when one write changes a field that is
 * embedded in many dynamically-keyed reads — equipping a frame re-skins every
 * gallery (`gallery:<dropId>`) and every profile (`profile:<id>`) at once, and
 * there is no way to name those keys up front.
 */
export function invalidatePrefix(prefix: string) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) invalidate(key);
  }
}

/** Fetch a key, deduping concurrent callers and caching the result. */
export async function fetchKey<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const gen = generation.get(key) ?? 0;
  if (__DEV__) console.log(`[cache] RPC fetch → ${key}`);
  let p!: Promise<T>;
  p = (async () => {
    try {
      const value = await fetcher();
      // Discard if an invalidate raced in while we were fetching: a newer write
      // superseded this read, so committing it would clobber the fresh data.
      if ((generation.get(key) ?? 0) === gen) {
        const entry = { value, at: Date.now() };
        store.set(key, entry);
        persistEntry(key, entry); // mirror to disk for the next cold start
        errors.delete(key); // recovered
        emit(key);
      }
      return value;
    } catch (err) {
      if ((generation.get(key) ?? 0) === gen) {
        errors.set(key, true); // surface an error state instead of loading forever
        emit(key);
      }
      throw err;
    } finally {
      // Only clear our own handle — an invalidate may have already replaced it
      // with a fresher fetch we must not evict.
      if (inflight.get(key) === p) inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p as Promise<T>;
}

// ---------------------------------------------------------------------------
// 2. Signed-URL cache
// ---------------------------------------------------------------------------
const SIGN_TTL = 3600; // seconds the URL is valid for (Supabase signed URL)
const SIGN_REUSE_MS = 50 * 60 * 1000; // reuse a signed URL for 50m (< 1h expiry)

const signed = new Map<string, { url: string; exp: number }>();
const signInflight = new Map<string, Promise<string | null>>();

/** Synchronous read of a still-fresh signed URL, or null. */
export function peekSigned(path: string): string | null {
  const c = signed.get(path);
  return c && c.exp > Date.now() ? c.url : null;
}

/** Sign one thumb path, reusing a fresh cached URL and deduping concurrent signs. */
export async function signThumb(path: string): Promise<string | null> {
  const fresh = peekSigned(path);
  if (fresh) return fresh;

  const existing = signInflight.get(path);
  if (existing) return existing;

  if (__DEV__) console.log(`[cache] sign 1 thumb`);
  const p = (async () => {
    try {
      const { data } = await supabase.storage.from("submissions").createSignedUrl(path, SIGN_TTL);
      if (data?.signedUrl) {
        signed.set(path, { url: data.signedUrl, exp: Date.now() + SIGN_REUSE_MS });
        return data.signedUrl;
      }
      return null;
    } finally {
      signInflight.delete(path);
    }
  })();

  signInflight.set(path, p);
  return p;
}

/** Batch-sign paths, requesting only the ones without a fresh cached URL. */
export async function signThumbs(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const needSet = new Set<string>();
  const need: string[] = [];
  for (const path of paths) {
    const fresh = peekSigned(path);
    if (fresh) out.set(path, fresh);
    else if (!needSet.has(path)) {
      needSet.add(path);
      need.push(path);
    }
  }

  if (need.length > 0) {
    if (__DEV__) console.log(`[cache] sign ${need.length} thumb(s) (${paths.length - need.length} cached)`);
    try {
      const { data } = await supabase.storage.from("submissions").createSignedUrls(need, SIGN_TTL);
      const exp = Date.now() + SIGN_REUSE_MS;
      data?.forEach((u) => {
        if (u.path && u.signedUrl) {
          signed.set(u.path, { url: u.signedUrl, exp });
          out.set(u.path, u.signedUrl);
        }
      });
    } catch (err) {
      // Partial success > total crash: return whatever we already had cached
      // rather than letting a single failed signing batch take down the entire
      // gallery/profile load.
      if (__DEV__) console.warn(`[cache] signThumbs batch failed — returning partial cached results`, err);
    }
  }
  return out;
}

/**
 * Stable disk-cache key for a signed storage URL. Supabase signed URLs carry a
 * rotating `?token=`, so expo-image's default (URL-keyed) disk cache misses once
 * the token changes — every app restart re-downloads the same bytes off mobile
 * data. Keying on the URL WITHOUT its query pins the cache to the object itself
 * (the storage path never changes and its bytes are immutable), so a cached image
 * survives token rotation and restarts and is never re-fetched. `undefined` for an
 * absent uri (expo-image then just uses the uri).
 */
export function imageCacheKey(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  const q = uri.indexOf("?");
  return q === -1 ? uri : uri.slice(0, q);
}

// Hooks live in lib/hooks/useCache.ts — import directly from there to avoid
// a require cycle (useCache imports cache primitives, cache re-exporting from
// useCache creates the cycle).
