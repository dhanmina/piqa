import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { signThumbs } from "./cache";
import { getConfig } from "./config";
import { supabase } from "./supabase";

export type ArchiveType = "free" | "daily";

export type ArchiveItem = {
  id: string;
  type: ArchiveType;
  thumbPath: string | null;
  imagePath: string | null;
  uri: string | null;
  capturedAt: string;
  starred: boolean;
  inGallery: boolean;
  isPotd: boolean;
};

export type Archive = {
  items: ArchiveItem[];
  /** Stars used this calendar month (across both tables). */
  starsUsed: number;
  starsCap: number;
  /** Earliest captured_at, for the "since {month}" header. */
  since: string | null;
};

function isThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

/**
 * The private journal: free captures + daily submissions merged, newest first.
 * Owner-only by RLS, so both tables are queried directly. Thumbs sign through
 * the shared cache. Refetches on focus (a new capture must appear on return).
 */
export function useArchive() {
  const [data, setData] = useState<Archive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (alive: () => boolean) => {
    setError(false);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      if (alive()) {
        setData({ items: [], starsUsed: 0, starsCap: 5, since: null });
        setLoading(false);
      }
      return;
    }

    const [{ data: free }, { data: daily }, cap] = await Promise.all([
      supabase
        .from("free_shots")
        .select("id, image_path, thumb_path, captured_at, starred, starred_at")
        .eq("user_id", uid)
        .order("captured_at", { ascending: false }),
      supabase
        .from("submissions")
        .select("id, image_path, thumb_path, captured_at, starred, starred_at, in_gallery, is_potd")
        .eq("user_id", uid)
        .not("thumb_path", "is", null)
        .order("captured_at", { ascending: false }),
      getConfig("stars_per_month"),
    ]);

    const rawFree = (free ?? []).map((r) => ({
      id: r.id,
      type: "free" as const,
      thumbPath: r.thumb_path,
      imagePath: r.image_path,
      capturedAt: r.captured_at,
      starred: r.starred,
      starredAt: r.starred_at,
      inGallery: false,
      isPotd: false,
    }));
    const rawDaily = (daily ?? []).map((r) => ({
      id: r.id,
      type: "daily" as const,
      thumbPath: r.thumb_path,
      imagePath: r.image_path,
      capturedAt: r.captured_at,
      starred: r.starred,
      starredAt: r.starred_at,
      inGallery: r.in_gallery,
      isPotd: r.is_potd,
    }));

    const merged = [...rawFree, ...rawDaily].sort(
      (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
    );

    const signed = await signThumbs(merged.map((m) => m.thumbPath).filter((p): p is string => !!p));
    const items: ArchiveItem[] = merged.map((m) => ({
      id: m.id,
      type: m.type,
      thumbPath: m.thumbPath,
      imagePath: m.imagePath,
      uri: m.thumbPath ? (signed.get(m.thumbPath) ?? null) : null,
      capturedAt: m.capturedAt,
      starred: m.starred,
      inGallery: m.inGallery,
      isPotd: m.isPotd,
    }));

    const starsUsed = merged.filter((m) => m.starred && isThisMonth(m.starredAt)).length;
    const since = merged.length > 0 ? merged[merged.length - 1].capturedAt : null;

    if (alive()) {
      setData({ items, starsUsed, starsCap: cap, since });
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setLoading(true);
      void load(() => mounted).catch(() => {
        if (mounted) {
          setLoading(false);
          setError(true);
        }
      });
      return () => {
        mounted = false;
      };
    }, [load]),
  );

  const refresh = useCallback(() => load(() => true), [load]);

  return { data, loading, error, refresh };
}

export type StarResult = { ok: boolean; reason?: string; starred?: boolean; used?: number; cap?: number };

export async function toggleStar(type: ArchiveType, id: string): Promise<StarResult> {
  const { data, error } = await supabase.rpc("toggle_star", { p_type: type, p_id: id });
  if (error) return { ok: false, reason: error.message };
  return data as unknown as StarResult;
}

/** Delete a free capture (row + storage objects). Daily shots are competition history and are not deletable here. */
export async function deleteFreeShot(item: ArchiveItem): Promise<boolean> {
  if (item.type !== "free") return false;
  const paths = [item.imagePath, item.thumbPath].filter((p): p is string => !!p);
  if (paths.length > 0) await supabase.storage.from("submissions").remove(paths);
  const { error } = await supabase.from("free_shots").delete().eq("id", item.id);
  return !error;
}
