import { useCallback, useEffect, useState } from "react";

import { useCached } from "./useCache";
import { useSession } from "../session";
import { supabase } from "../services/supabase";
import {
  loadGallery,
  loadFollowingGallery,
  LATEST_GALLERY_TTL,
  PAST_GALLERY_TTL,
  type GalleryDetailPhoto,
  type GalleryFeed,
} from "../services/gallery";

export type { GalleryDetailPhoto, GalleryFeed };

export function useGallery(dropId: string | null) {
  const key = `gallery:${dropId ?? "latest"}`;
  const ttl = dropId ? PAST_GALLERY_TTL : LATEST_GALLERY_TTL;
  const { data, loading, error, refresh } = useCached<GalleryFeed>(key, () => loadGallery(dropId), ttl);
  return { data, loading, error, refresh };
}

export function useFollowingGallery() {
  const { data, loading, error, refresh } = useCached<GalleryDetailPhoto[]>("gallery:following", loadFollowingGallery, 5 * 60_000);
  return { photos: data ?? [], loading, error, refresh };
}

const MAX_GLOBAL_HEARTS = 200;
const globalBaseHearts: Record<string, boolean> = {};
const globalOptimisticHearts: Record<string, boolean> = {};

function capGlobalMaps() {
  const baseKeys = Object.keys(globalBaseHearts);
  if (baseKeys.length > MAX_GLOBAL_HEARTS) {
    const evict = baseKeys.slice(0, baseKeys.length - MAX_GLOBAL_HEARTS + 50);
    for (const k of evict) {
      delete globalBaseHearts[k];
      delete globalOptimisticHearts[k];
    }
  }
}

export function useGalleryHearts(photos: { id: string; hearts: number }[]) {
  const { session } = useSession();
  const myId = session?.user.id;
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const idsKey = photos.map((p) => p.id).join(",");
  useEffect(() => {
    if (!myId || photos.length === 0) {
      setLiked(new Set());
      return;
    }
    let alive = true;
    void supabase
      .from("reactions")
      .select("submission_id")
      .eq("user_id", myId)
      .in("submission_id", idsKey.split(","))
      .then(
        ({ data }) => {
          const fetchedSet = new Set((data ?? []).map((r) => r.submission_id));
          idsKey.split(",").forEach(id => {
            globalBaseHearts[id] = fetchedSet.has(id);
          });
          capGlobalMaps();
          if (alive) setLiked(fetchedSet);
        },
        (e) => console.warn('Failed to fetch gallery hearts:', e)
      );
    return () => {
      alive = false;
    };
  }, [myId, idsKey]);

  const getBase = useCallback((id: string) => globalBaseHearts[id] ?? liked.has(id), [liked]);
  const isLiked = useCallback((id: string) => optimistic[id] ?? globalOptimisticHearts[id] ?? getBase(id), [optimistic, getBase]);

  const count = useCallback(
    (p: { id: string; hearts: number }) => Math.max(0, p.hearts - (getBase(p.id) ? 1 : 0) + (isLiked(p.id) ? 1 : 0)),
    [getBase, isLiked],
  );

  const toggle = useCallback(
    async (id: string) => {
      if (!myId) return;
      const next = !isLiked(id);
      setOptimistic((m) => ({ ...m, [id]: next }));
      globalOptimisticHearts[id] = next;
      try {
        if (next) {
          const { error } = await supabase.from("reactions").insert({ user_id: myId, submission_id: id, emoji: "heart" });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("reactions").delete().eq("user_id", myId).eq("submission_id", id);
          if (error) throw error;
        }
      } catch (e) {
        console.warn('Failed to toggle heart:', e);
        setOptimistic((m) => ({ ...m, [id]: !next }));
        globalOptimisticHearts[id] = !next;
      }
    },
    [myId, isLiked],
  );

  return { isLiked, count, toggle };
}
