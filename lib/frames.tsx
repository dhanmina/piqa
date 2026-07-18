import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchKey, invalidatePrefix } from "./cache";
import { useSession } from "./session";
import { supabase } from "./supabase";

/**
 * Frames are OVERLAYS whose LOOK is data, so a new frame can be added from a
 * dashboard (Supabase Studio) with no app release. The app owns the rail layout;
 * a frame record owns only what varies — hairline, marker glyph, suffix, counter
 * color. See src/components/molecules/FramedPhoto.tsx and the frames table.
 *
 * Two things live on a frame and they are deliberately unrelated:
 *   FrameId  — the OWNER's choice, applies to every photo they own, everywhere.
 *   Status   — the PHOTO's result, written by close_day and nothing else.
 */
export type FrameId = string;
export type PhotoStatus = "crown" | "top10" | null;

/**
 * A marker is a NAMED shape, not an uploaded SVG: the app draws it as literal
 * native paths (FramedPhoto's MarkerGlyph), which is the only thing that renders
 * reliably across builds. A frame picks a shape; adding a frame is still just data
 * (shape + colors + suffix), and only a brand-new shape needs an app release.
 * null → the default triangle.
 */
export type MarkerShape = string | null;

export type FrameDef = {
  id: FrameId;
  label: string;
  hairlineColor: string;
  hairlineOpacity: number;
  counterColor: string;
  markerShape: MarkerShape;
  suffixText: string | null;
  suffixColor: string | null;
  /** Avatar-ring accent when this frame is equipped as the PROFILE frame. null → no
   *  frame ring (the level ring shows instead). */
  ringColor: string | null;
  /** The avatar-frame SVG, admin-managed in the frames table and rendered via SvgXml.
   *  null → a plain ring (ringColor / the level ring). See the profile_svg contract. */
  profileSvg: string | null;
  unlockKind: string; // 'default' | 'potd' | 'event' | 'manual'
  unlockLabel: string | null;
  eventStart: string | null;
  eventEnd: string | null;
};

/**
 * Fallback shape for the built-in frames when the marker_shape column isn't set
 * (e.g. a DB that predates that migration), so the crown draws correctly without
 * a push. Real data (marker_shape) takes precedence.
 */
function inferMarkerShape(id: string): MarkerShape {
  if (id === "crown") return "crown";
  if (id === "valentines") return "heart";
  return null;
}

/**
 * The one frame the app ships knowing — its bootstrap and its fallback. Any photo
 * renders correctly with this before the catalog loads and for any unknown id, so a
 * frame never pops in broken. Every OTHER frame (crown, event frames) comes purely
 * from data; the source of truth is the DB, this is only the safety net.
 */
export const DEFAULT_FRAME_DEF: FrameDef = {
  id: "default",
  label: "Default",
  hairlineColor: "#F2EDE4",
  hairlineOpacity: 0.35,
  counterColor: "#F2EDE4",
  markerShape: null,
  suffixText: null,
  suffixColor: null,
  ringColor: null,
  profileSvg: null,
  unlockKind: "default",
  unlockLabel: null,
  eventStart: null,
  eventEnd: null,
};

// Fields are optional on purpose: a live DB may predate the migration that adds
// these columns, so `select('*')` can return a row with only id/label. rowToDef
// coalesces the rest.
type FrameRow = {
  id: string;
  label?: string | null;
  hairline_color?: string | null;
  hairline_opacity?: number | null;
  counter_color?: string | null;
  marker_shape?: string | null;
  suffix_text?: string | null;
  suffix_color?: string | null;
  ring_color?: string | null;
  profile_svg?: string | null;
  unlock_kind?: string | null;
  unlock_label?: string | null;
  event_start?: string | null;
  event_end?: string | null;
};

function rowToDef(r: FrameRow): FrameDef {
  // Coalesce every render-critical field to the default. A row can be partial —
  // the migration that adds these columns may not have run yet, or a dashboard row
  // may leave a color blank — and an undefined SVG `fill`/`stroke` renders BLACK.
  // A frame must never render broken, so a missing color falls back to paper, not
  // black. Once real values are present they flow straight through.
  return {
    id: r.id,
    label: r.label ?? r.id,
    hairlineColor: r.hairline_color ?? DEFAULT_FRAME_DEF.hairlineColor,
    hairlineOpacity: r.hairline_opacity ?? DEFAULT_FRAME_DEF.hairlineOpacity,
    counterColor: r.counter_color ?? DEFAULT_FRAME_DEF.counterColor,
    markerShape: r.marker_shape ?? inferMarkerShape(r.id),
    suffixText: r.suffix_text ?? null,
    suffixColor: r.suffix_color ?? null,
    // Fall back to the frame's suffix accent so a frame rings correctly even before
    // ring_color is populated (crown → gold, valentines → red, default → null).
    ringColor: r.ring_color ?? r.suffix_color ?? null,
    profileSvg: r.profile_svg ?? null,
    unlockKind: r.unlock_kind ?? 'manual',
    unlockLabel: r.unlock_label ?? null,
    eventStart: r.event_start ?? null,
    eventEnd: r.event_end ?? null,
  };
}

async function fetchCatalog(): Promise<Map<FrameId, FrameDef>> {
  const { data, error } = await supabase.from("frames").select("*");
  if (error) throw error;
  const map = new Map<FrameId, FrameDef>();
  for (const row of (data ?? []) as FrameRow[]) map.set(row.id, rowToDef(row));
  if (!map.has("default")) map.set("default", DEFAULT_FRAME_DEF); // default is load-bearing
  return map;
}

const BOOTSTRAP = new Map<FrameId, FrameDef>([["default", DEFAULT_FRAME_DEF]]);

const FrameCatalogContext = createContext<Map<FrameId, FrameDef>>(BOOTSTRAP);

/**
 * Loads every frame once at app start (a tiny query) and holds the catalog for the
 * whole tree. Frames change only when the table changes (rare), so there is no TTL
 * churn — the catalog is fetched once and reused. Lives above the navigator, so it
 * cannot use useCached (that hook's focus effect needs navigation context); it
 * fetches directly through the shared cache instead.
 */
export function FrameCatalogProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [catalog, setCatalog] = useState<Map<FrameId, FrameDef>>(BOOTSTRAP);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    void fetchKey("frames:catalog", fetchCatalog)
      .then((m) => {
        if (alive) setCatalog(m);
      })
      .catch(() => {
        /* keep the bootstrap catalog; default still renders every photo */
      });
    return () => {
      alive = false;
    };
  }, [session]);

  return <FrameCatalogContext.Provider value={catalog}>{children}</FrameCatalogContext.Provider>;
}

export function useFrameCatalog(): Map<FrameId, FrameDef> {
  return useContext(FrameCatalogContext);
}

/** Resolve an id to its definition, falling back to default for anything unknown. */
export function useFrameDef(id: FrameId): FrameDef {
  const catalog = useFrameCatalog();
  return catalog.get(id) ?? catalog.get("default") ?? DEFAULT_FRAME_DEF;
}

/**
 * The CONTEXTUAL frame for a photo, from the day it was captured: the event frame
 * whose window contains that date, else 'default'. Mirrors the server's photo_frame()
 * (used by decorate_photos for gallery/profile) for the surfaces the client queries
 * directly — Today and Archive — so a photo never wears a frame from another day.
 */
export function frameForDate(catalog: Map<FrameId, FrameDef>, dateISO: string | null | undefined): FrameId {
  if (!dateISO) return "default";
  const d = dateISO.slice(0, 10); // YYYY-MM-DD
  for (const def of catalog.values()) {
    if (def.unlockKind === "event" && def.eventStart && def.eventEnd && d >= def.eventStart && d <= def.eventEnd) {
      return def.id;
    }
  }
  return "default";
}

/** Hook form of frameForDate for single-date surfaces (Today's prints). */
export function useFrameForDate(dateISO: string | null | undefined): FrameId {
  return frameForDate(useFrameCatalog(), dateISO);
}

/** Server strings are untrusted at the type level; funnel them through these. */
export function asFrameId(v: string | null | undefined): FrameId {
  return v && typeof v === "string" ? v : "default";
}

export function asStatus(v: string | null | undefined): PhotoStatus {
  return v === "crown" || v === "top10" ? v : null;
}

/** You own a frame if it's a default frame, or you've unlocked it. */
export function frameOwned(def: FrameDef, owned: FrameId[]): boolean {
  return def.unlockKind === "default" || owned.includes(def.id);
}

/** An event frame can be claimed only inside its window. */
export function frameClaimable(def: FrameDef, today: Date = new Date()): boolean {
  if (def.unlockKind !== "event" || !def.eventStart || !def.eventEnd) return false;
  const d = today.toISOString().slice(0, 10);
  return d >= def.eventStart && d <= def.eventEnd;
}

/**
 * Equip a PROFILE frame. The client cannot cheat this: user_frames has no insert
 * grant (only close_day's trigger and the event-frame trigger write it) and a trigger
 * on profiles rejects equipping a frame you have not unlocked.
 *
 * The equipped frame is now the avatar ring ONLY — it never touches photos (those wear
 * their own day's frame). So this drops NO caches: the old gallery/home invalidation is
 * pointless now, and deleting the profile cache made the picker flash to a loading state
 * mid-equip. The caller refreshes the profile (stale-while-revalidate) to pick up the
 * new ring with no flash.
 */
export async function equipFrame(id: FrameId): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;

  const { error } = await supabase.from("profiles").update({ equipped_frame: id }).eq("id", uid);
  return !error;
}

/**
 * Claim an event frame during its window. The RPC is the only client-reachable
 * writer of user_frames and can only grant an event frame in-window, so the crown
 * (a 'potd' frame) stays unforgeable. On success the profile cache is dropped so
 * the picker unlocks it.
 */
export async function claimEventFrame(id: FrameId): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_event_frame", { p_frame: id });
  if (error) return false;
  const ok = (data as unknown as { ok: boolean } | null)?.ok === true;
  if (ok) invalidatePrefix("profile:");
  return ok;
}
