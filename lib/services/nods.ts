import { supabase } from "./supabase";

const NOD_LABELS: Record<string, string> = {
  great_light: "Beautiful light",
  strong_composition: "Nicely framed",
  bold_color: "Love the colors",
  perfect_timing: "Perfect timing",
  fresh_perspective: "Love the angle",
  so_creative: "So creative",
  tells_a_story: "Tells a story",
};

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

export type NodCounts = Record<string, number>;

export const nodLabel = (id: string): string => NOD_LABELS[id] ?? id;

export async function submitNod(submissionId: string, tag: NodTag): Promise<boolean> {
  const { error } = await supabase.rpc("submit_nod" as never, {
    p_submission: submissionId,
    p_tag: tag,
  } as never);
  if (error) console.warn("submitNod failed:", error);
  return !error;
}

export async function getPhotoNods(submissionId: string): Promise<NodCounts> {
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

export const nodTotal = (nods?: NodCounts | null): number =>
  nods ? Object.values(nods).reduce((a, b) => a + b, 0) : 0;

export function topNod(nods?: NodCounts | null): { label: string; count: number } | null {
  const entries = Object.entries(nods ?? {});
  if (entries.length === 0) return null;
  const [id, count] = entries.sort((a, b) => b[1] - a[1])[0];
  return { label: nodLabel(id), count };
}

export async function getNodsReceived(userId?: string): Promise<NodCounts> {
  const { data, error } = await supabase.rpc(
    "get_nods_received" as never,
    (userId ? { p_user: userId } : {}) as never,
  );
  if (error || !data) return {};
  return data as NodCounts;
}
