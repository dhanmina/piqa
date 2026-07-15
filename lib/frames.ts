import { invalidate, invalidatePrefix } from "./cache";
import { HOME_KEY } from "./homeState";
import { supabase } from "./supabase";

/**
 * Frames are OVERLAYS. They are never composited into a stored or uploaded file,
 * which is exactly why equipping one can re-skin every photo you have ever taken
 * without touching a single byte in storage.
 *
 * Two things live on a frame and they are deliberately unrelated:
 *
 *   FrameId  — the OWNER's choice. Applies to every photo they own, everywhere.
 *   Status   — the PHOTO's result, written by close_day and by nothing else.
 *              A crown-frame user can post a photo that placed nowhere, and a
 *              default-frame user can win the day. The rail says who you are;
 *              the status glyph says what this photo did.
 */
export type FrameId = "default" | "crown";
export type PhotoStatus = "crown" | "top10" | null;

export const FRAMES: { id: FrameId; label: string; unlock: string | null }[] = [
  { id: "default", label: "Default", unlock: null },
  { id: "crown", label: "Crown", unlock: "Win a Photo of the Day" },
];

/** Server strings are untrusted at the type level; funnel them through these. */
export function asFrameId(v: string | null | undefined): FrameId {
  return v === "crown" ? "crown" : "default";
}

export function asStatus(v: string | null | undefined): PhotoStatus {
  return v === "crown" || v === "top10" ? v : null;
}

/**
 * Equip a frame. The client cannot cheat this: `user_frames` has no insert grant
 * (only close_day writes it) and a trigger on profiles rejects equipping a frame
 * you have not unlocked, so a hand-rolled request just errors.
 *
 * Every framed surface reads the owner's frame live, so all we do locally is drop
 * the caches that carry it — no photo is re-fetched, re-uploaded or re-rendered
 * from source.
 */
export async function equipFrame(id: FrameId): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;

  const { error } = await supabase.from("profiles").update({ equipped_frame: id }).eq("id", uid);
  if (error) return false;

  invalidatePrefix("gallery:"); // gallery:latest, gallery:following, gallery:<dropId>
  invalidatePrefix("profile:"); // profile:self and any visited profile
  invalidate(HOME_KEY);
  return true;
}
