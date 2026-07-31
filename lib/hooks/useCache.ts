import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { errors, emit, fetchKey, peek, peekSigned, signThumb, subscribers } from "../cache";

export type Cached<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
};

export function useCached<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Cached<T> {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let set = subscribers.get(key);
    if (!set) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(rerender);
    return () => {
      set.delete(rerender);
      if (set.size === 0) subscribers.delete(key);
    };
  }, [key, rerender]);

  useFocusEffect(
    useCallback(() => {
      const entry = peek<T>(key);
      const age = entry ? Date.now() - entry.at : null;
      const stale = !entry || (age !== null && age > ttlMs);
      console.log(`[cache] useCached(${key}): focus check — has_entry=${!!entry} age_ms=${age ?? "n/a"} ttl_ms=${ttlMs} will_fetch=${stale}`);
      if (stale) void fetchKey(key, fetcher);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, ttlMs]),
  );

  const refresh = useCallback(async () => {
    console.log(`[cache] useCached(${key}): manual refresh() called`);
    errors.delete(key);
    emit(key);
    try {
      await fetchKey(key, fetcher);
    } catch {
      /* surfaced via errors map */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const entry = peek<T>(key);
  const failed = errors.get(key) === true && !entry;
  return { data: (entry?.value as T) ?? null, loading: !entry && !failed, error: failed, refresh };
}

export function useSignedThumb(path: string | null | undefined) {
  const [uri, setUri] = useState<string | null>(() => (path ? peekSigned(path) : null));

  useEffect(() => {
    let alive = true;
    if (!path) {
      setUri(null);
      return;
    }
    const fresh = peekSigned(path);
    if (fresh) {
      setUri(fresh);
      return;
    }
    void signThumb(path).then((u) => {
      if (alive) setUri(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return uri;
}
