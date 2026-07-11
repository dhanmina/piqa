import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import type { GalleryPhoto } from "@/components/molecules/GalleryGrid";
import { supabase } from "./supabase";

const SIGNED_TTL = 3600;

/** Sign a single private thumb path for display (Today's winner card). */
export function useSignedThumb(path: string | null | undefined) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUri(null);
      return;
    }
    supabase.storage
      .from("submissions")
      .createSignedUrl(path, SIGNED_TTL)
      .then(({ data }) => {
        if (alive) setUri(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return uri;
}

type GalleryRow = {
  id: string;
  thumb_path: string | null;
  hearts: number;
  shooter: string;
  is_potd: boolean;
};

type LatestGalleryResult = {
  drop: { id: string; prompt: string | null; drop_date: string } | null;
  photos: GalleryRow[];
  is_seed: boolean;
};

export type LatestGallery = {
  drop: { id: string; prompt: string | null; drop_date: string } | null;
  /** Whether this is the seed fallback (no real gallery has closed yet). */
  isSeed: boolean;
  photos: GalleryPhoto[];
};

/**
 * The most recent revealed gallery for my region, or the seed fallback.
 * Signs all thumb paths in a single batch call, then maps to GalleryGrid rows.
 */
export function useLatestGallery() {
  const [data, setData] = useState<LatestGallery | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (alive: () => boolean) => {
    try {
      const { data: res, error } = await supabase.rpc("get_latest_gallery");
      if (error) throw error;
      const result = res as unknown as LatestGalleryResult;
      if (!result?.drop) {
        if (alive()) setData({ drop: null, isSeed: false, photos: [] });
        return;
      }

      const paths = result.photos.map((p) => p.thumb_path).filter((p): p is string => !!p);
      const signed = new Map<string, string>();
      if (paths.length > 0) {
        // Signing must never sink the whole screen — degrade to skeleton tiles.
        const { data: urls } = await supabase.storage.from("submissions").createSignedUrls(paths, SIGNED_TTL);
        urls?.forEach((u) => {
          if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
        });
      }

      const photos: GalleryPhoto[] = result.photos.map((p) => ({
        id: p.id,
        uri: p.thumb_path ? (signed.get(p.thumb_path) ?? null) : null,
        hearts: p.hearts,
        isPotd: p.is_potd,
        shooter: p.shooter,
      }));

      if (alive()) setData({ drop: result.drop, isSeed: result.is_seed, photos });
    } catch (err) {
      if (__DEV__) console.warn("[gallery] load failed:", err);
      if (alive()) setData({ drop: null, isSeed: false, photos: [] });
    } finally {
      // Always resolve loading — a thrown RPC/sign call must not leave the
      // gallery stuck on a blank skeleton.
      if (alive()) setLoading(false);
    }
  }, []);

  // Refetch on every focus: tab screens stay mounted, so a plain mount-effect
  // would keep showing stale (pre-upload) data until a full app reload.
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void load(() => mounted);
      return () => {
        mounted = false;
      };
    }, [load]),
  );

  return { data, loading };
}
