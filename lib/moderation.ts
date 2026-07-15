import { invalidate } from "./cache";
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

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
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
