import { myId } from "./auth";
import { invalidate } from "../cache";
import { supabase } from "./supabase";

/** Report reasons (spec §12). Values must match the reports.reason check. */
export const REPORT_REASONS = [
  { value: "nudity", label: "Nudity or sexual content", desc: "Explicit or sexual imagery" },
  { value: "violence", label: "Violence or gore", desc: "Graphic or disturbing content" },
  { value: "harassment", label: "Harassment or hate", desc: "Targets or demeans someone" },
  { value: "not_real_photo", label: "Not a real photo", desc: "AI-generated, or not their own shot" },
  { value: "other", label: "Something else", desc: "Doesn't belong on Piqa" },
] as const;

function refreshPublicSurfaces() {
  // The reporter/blocker should see the content disappear next time they look.
  invalidate("gallery:latest");
  invalidate("gallery:following");
}

/** One report hides the photo from you instantly; 3 distinct reporters quarantine it. */
export async function reportSubmission(submissionId: string, reason: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("report_submission", { p_submission: submissionId, p_reason: reason });
  if (error) return false;
  refreshPublicSurfaces();
  return (data as unknown as { ok: boolean }).ok;
}

/** Block = mutual invisibility (spec §9): each user vanishes from the other's surfaces. */
export async function blockUser(target: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase.from("blocks").insert({ blocker_id: me, blocked_id: target });
  if (!error) refreshPublicSurfaces();
  return !error;
}

export async function unblockUser(target: string): Promise<boolean> {
  const me = await myId();
  if (!me) return false;
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", me).eq("blocked_id", target);
  if (!error) refreshPublicSurfaces();
  return !error;
}

export type BlockedUser = { id: string; username: string; avatar_url: string | null };

/**
 * The accounts I've blocked, for the Settings management list. A block is my own
 * row (blocks RLS lets me read blocker_id = me), so this is a plain two-step read
 * mirroring fetchFollowing — no definer RPC needed. Newest block first.
 */
export async function fetchBlocked(): Promise<BlockedUser[]> {
  const me = await myId();
  if (!me) return [];
  const { data: rows } = await supabase
    .from("blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", me)
    .order("created_at", { ascending: false });
  const ids = (rows ?? []).map((r) => r.blocked_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
  // Preserve the blocks' newest-first order (the .in() above returns arbitrary order).
  const byId = new Map((profs ?? []).map((p) => [p.id, p as BlockedUser]));
  return ids.map((id) => byId.get(id)).filter((u): u is BlockedUser => !!u);
}
