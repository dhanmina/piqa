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
