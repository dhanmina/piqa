import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Supabase signs a fresh token on every createSignedUrl call, so if we re-sign
// on each app/Metro reload the url (and therefore expo-image's uri-keyed disk
// cache entry) changes every time and the photo re-downloads. Persisting the
// signed url itself keeps it stable across reloads until it's actually close
// to expiring, so the normal uri-based cache just hits.
const TTL_SECONDS = 24 * 60 * 60;
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

type CachedEntry = { url: string; expiresAt: number };

function storageKey(path: string): string {
  return `signedurl:captures:${path}`;
}

async function readCached(path: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(path));
    if (!raw) return null;
    const entry: CachedEntry = JSON.parse(raw);
    if (entry.expiresAt - REFRESH_MARGIN_MS <= Date.now()) return null;
    return entry.url;
  } catch {
    return null;
  }
}

function writeCached(path: string, url: string): void {
  const entry: CachedEntry = { url, expiresAt: Date.now() + TTL_SECONDS * 1000 };
  AsyncStorage.setItem(storageKey(path), JSON.stringify(entry)).catch(() => {});
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const cached = await readCached(path);
  if (cached) return cached;
  try {
    const { data, error } = await supabase.storage.from('captures').createSignedUrl(path, TTL_SECONDS);
    if (error) console.error('[signedUrlCache] createSignedUrl failed', path, error);
    if (data?.signedUrl) {
      writeCached(path, data.signedUrl);
      return data.signedUrl;
    }
  } catch (err) {
    console.error('[signedUrlCache] createSignedUrl threw', path, err);
  }
  return null;
}

// logErrors: false for a lookup the caller already expects to partially miss (e.g.
// timeline resolving a thumbnail that may not exist for a capture predating thumbnails,
// then falling back to the full-res path) -- an unresolved path there isn't a bug, so
// logging it as [signedUrlCache] error would just be alarming noise on old data.
export async function getSignedUrls(paths: string[], options?: { logErrors?: boolean }): Promise<Map<string, string>> {
  const logErrors = options?.logErrors ?? true;
  const result = new Map<string, string>();
  const misses: string[] = [];
  await Promise.all(
    paths.map(async (path) => {
      const cached = await readCached(path);
      if (cached) result.set(path, cached);
      else misses.push(path);
    })
  );
  if (misses.length > 0) {
    try {
      const { data, error } = await supabase.storage.from('captures').createSignedUrls(misses, TTL_SECONDS);
      if (error && logErrors) console.error('[signedUrlCache] createSignedUrls failed', misses, error);
      data?.forEach((s) => {
        if (s.signedUrl && s.path) {
          result.set(s.path, s.signedUrl);
          writeCached(s.path, s.signedUrl);
        } else if (s.error && logErrors) {
          console.error('[signedUrlCache] entry failed', s.path, s.error);
        }
      });
    } catch (err) {
      if (logErrors) console.error('[signedUrlCache] createSignedUrls threw', misses, err);
    }
  }
  return result;
}
