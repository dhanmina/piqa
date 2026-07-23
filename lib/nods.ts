import { useEffect, useState } from "react";

import { supabase } from "./supabase";

/**
 * Nods (build plan 1B · feature-research §3): a Curator's craft-recognition tag on
 * a photo — the payoff of comments with none of the toxicity. A fixed, positive-
 * only set (no free text), one per curator per photo. Server: submit_nod + the
 * `nods` aggregate on decorate_photos output.
 *
 * ONE universal craft vocabulary (so "what your work is known for" aggregates
 * coherently across all your photos), worded the natural way a person actually
 * compliments a shot — not clinical craft terms. Kept deliberately SMALL: too many
 * options is choice overload, so a photo only ever offers a tight, relevant few
 * (`nodsFor`), and the whole vocabulary stays short.
 */

// Display labels for EVERY tag that can exist in the DB — including ones retired
// from the picker (e.g. "moved_me") — so a historical aggregate never shows a raw id.
const NOD_LABELS: Record<string, string> = {
  great_light: "Beautiful light",
  strong_composition: "Nicely framed",
  bold_color: "Love the colors",
  perfect_timing: "Perfect timing",
  fresh_perspective: "Love the angle",
  so_creative: "So creative",
  tells_a_story: "Tells a story",
  moved_me: "Moved me", // retired from the picker; still labels old nods
};

// The tags OFFERED — natural, positive, and few. "Moved me" is retired (too vague /
// not a craft cue). A fitting nod still exists for any image.
export const NOD_TAGS = [
  { id: "great_light", label: NOD_LABELS.great_light },
  { id: "strong_composition", label: NOD_LABELS.strong_composition },
  { id: "bold_color", label: NOD_LABELS.bold_color },
  { id: "perfect_timing", label: NOD_LABELS.perfect_timing },
  { id: "fresh_perspective", label: NOD_LABELS.fresh_perspective },
  { id: "so_creative", label: NOD_LABELS.so_creative },
  { id: "tells_a_story", label: NOD_LABELS.tells_a_story },
] as const;

export type NodTag = (typeof NOD_TAGS)[number]["id"];

/**
 * The picker shows only FOUR tags — enough to fit any shot, few enough to choose in
 * a glance. Each Subject category leads with its natural fit; unknown category →
 * a sensible default four.
 */
const NODS_BY_CATEGORY: Record<string, NodTag[]> = {
  light:   ["great_light", "bold_color", "strong_composition", "so_creative"],
  color:   ["bold_color", "great_light", "strong_composition", "so_creative"],
  object:  ["strong_composition", "great_light", "bold_color", "so_creative"],
  pov:     ["fresh_perspective", "strong_composition", "great_light", "tells_a_story"],
  absurd:  ["so_creative", "perfect_timing", "tells_a_story", "strong_composition"],
  emotion: ["tells_a_story", "so_creative", "great_light", "perfect_timing"],
};
const DEFAULT_PICKER: NodTag[] = ["great_light", "strong_composition", "bold_color", "so_creative"];

export function nodsFor(category?: string | null): readonly { id: NodTag; label: string }[] {
  const ids = (category ? NODS_BY_CATEGORY[category] : undefined) ?? DEFAULT_PICKER;
  return ids.map((id) => NOD_TAGS.find((t) => t.id === id)!).filter(Boolean);
}

/** Per-photo aggregate as it arrives from the server: { great_light: 38, ... }. */
export type NodCounts = Record<string, number>;

export const nodLabel = (id: string): string => NOD_LABELS[id] ?? id;

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

/**
 * Per-photo nod aggregate ({ great_light: 3, ... }), fetched directly — aggregates
 * are public (RLS `select using (true)`, like hearts). Used when a surface didn't
 * already carry the decorate_photos `nods` (e.g. a profile's wins), so its
 * fullscreen reads identically to the gallery's.
 */
export async function getPhotoNods(submissionId: string): Promise<NodCounts> {
  // Cast until `supabase gen types` re-runs after the nods migration deploys.
  const { data, error } = await (supabase as never as {
    from: (t: string) => {
      select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: { tag: string }[] | null; error: unknown }> };
    };
  })
    .from("nods")
    .select("tag")
    .eq("submission_id", submissionId);
  if (error || !data) return {};
  const counts: NodCounts = {};
  for (const r of data) counts[r.tag] = (counts[r.tag] ?? 0) + 1;
  return counts;
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
