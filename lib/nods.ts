import { useEffect, useState } from "react";

import { supabase } from "./supabase";

/**
 * Nods (build plan 1B · feature-research §3): a Curator's craft-recognition tag on
 * a photo — the payoff of comments with none of the toxicity. A fixed, positive-
 * only set (no free text), one per curator per photo. Server: submit_nod + the
 * `nods` aggregate on decorate_photos output.
 */
export const NOD_TAGS = [
  { id: "great_light", label: "Great light" },
  { id: "strong_composition", label: "Strong composition" },
  { id: "bold_color", label: "Bold color" },
  { id: "perfect_timing", label: "Perfect timing" },
  { id: "moved_me", label: "Moved me" },
] as const;

export type NodTag = (typeof NOD_TAGS)[number]["id"];

/** Per-photo aggregate as it arrives from the server: { great_light: 38, ... }. */
export type NodCounts = Record<string, number>;

export const nodLabel = (id: string): string =>
  NOD_TAGS.find((t) => t.id === id)?.label ?? id;

/** Attach (or change) your nod on a photo. No-op-safe; returns false on failure. */
export async function submitNod(submissionId: string, tag: NodTag): Promise<boolean> {
  // Cast until `supabase gen types` re-runs after the nods migration deploys.
  const { error } = await supabase.rpc("submit_nod" as never, {
    p_submission: submissionId,
    p_tag: tag,
  } as never);
  if (error) console.warn("submitNod failed:", error);
  return !error;
}

/** Total nods across all tags. */
export const nodTotal = (nods?: NodCounts | null): number =>
  nods ? Object.values(nods).reduce((a, b) => a + b, 0) : 0;

/** The most-given tag + its count, for a compact "Curators nodded: X ×N" line. */
export function topNod(nods?: NodCounts | null): { label: string; count: number } | null {
  const entries = Object.entries(nods ?? {});
  if (entries.length === 0) return null;
  const [id, count] = entries.sort((a, b) => b[1] - a[1])[0];
  return { label: nodLabel(id), count };
}

/** All the nods a photographer's shots have earned, aggregated by tag. */
export async function getNodsReceived(userId?: string): Promise<NodCounts> {
  const { data, error } = await supabase.rpc(
    "get_nods_received" as never,
    (userId ? { p_user: userId } : {}) as never,
  );
  if (error || !data) return {};
  return data as NodCounts;
}

/** Tags a user's work is known for, sorted high→low: [{ label, count }]. */
export function useNodsReceived(userId?: string | null): { label: string; count: number }[] {
  const [nods, setNods] = useState<NodCounts>({});
  useEffect(() => {
    if (!userId) {
      setNods({});
      return;
    }
    let alive = true;
    void getNodsReceived(userId).then((n) => {
      if (alive) setNods(n);
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  return Object.entries(nods)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ label: nodLabel(id), count }));
}
