import { invalidatePrefix } from "../cache";
import { supabase } from "./supabase";

export type FrameId = string;
export type PhotoStatus = "crown" | "top10" | null;
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
  ringColor: string | null;
  profileSvg: string | null;
  unlockKind: string;
  unlockLabel: string | null;
  /** RevenueCat/Play product id this frame is granted by. null for anything not
   *  unlock_kind='purchase'. */
  productId: string | null;
  eventStart: string | null;
  eventEnd: string | null;
};

function inferMarkerShape(id: string): MarkerShape {
  if (id === "crown") return "crown";
  if (id === "valentines") return "heart";
  return null;
}

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
  productId: null,
  eventStart: null,
  eventEnd: null,
};

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
  product_id?: string | null;
  event_start?: string | null;
  event_end?: string | null;
};

function rowToDef(r: FrameRow): FrameDef {
  return {
    id: r.id,
    label: r.label ?? r.id,
    hairlineColor: r.hairline_color ?? DEFAULT_FRAME_DEF.hairlineColor,
    hairlineOpacity: r.hairline_opacity ?? DEFAULT_FRAME_DEF.hairlineOpacity,
    counterColor: r.counter_color ?? DEFAULT_FRAME_DEF.counterColor,
    markerShape: r.marker_shape ?? inferMarkerShape(r.id),
    suffixText: r.suffix_text ?? null,
    suffixColor: r.suffix_color ?? null,
    ringColor: r.ring_color ?? r.suffix_color ?? null,
    profileSvg: r.profile_svg ?? null,
    unlockKind: r.unlock_kind ?? 'manual',
    unlockLabel: r.unlock_label ?? null,
    productId: r.product_id ?? null,
    eventStart: r.event_start ?? null,
    eventEnd: r.event_end ?? null,
  };
}

export async function fetchCatalog(): Promise<Map<FrameId, FrameDef>> {
  const { data, error } = await supabase.from("frames").select("*");
  if (error) throw error;
  const map = new Map<FrameId, FrameDef>();
  for (const row of (data ?? []) as FrameRow[]) map.set(row.id, rowToDef(row));
  if (!map.has("default")) map.set("default", DEFAULT_FRAME_DEF);
  return map;
}

export const BOOTSTRAP = new Map<FrameId, FrameDef>([["default", DEFAULT_FRAME_DEF]]);

export function frameForDate(catalog: Map<FrameId, FrameDef>, dateISO: string | null | undefined): FrameId {
  if (!dateISO) return "default";
  const d = dateISO.slice(0, 10);
  for (const def of catalog.values()) {
    if (def.unlockKind === "event" && def.eventStart && def.eventEnd && d >= def.eventStart && d <= def.eventEnd) {
      return def.id;
    }
  }
  return "default";
}

export function asFrameId(v: string | null | undefined): FrameId {
  return v && typeof v === "string" ? v : "default";
}

export function asStatus(v: string | null | undefined): PhotoStatus {
  return v === "crown" || v === "top10" ? v : null;
}

export function frameOwned(def: FrameDef, owned: FrameId[]): boolean {
  return def.unlockKind === "default" || owned.includes(def.id);
}

export function framePurchasable(def: FrameDef, owned: FrameId[]): boolean {
  return def.unlockKind === "purchase" && def.productId !== null && !frameOwned(def, owned);
}

export function frameClaimable(def: FrameDef, today: Date = new Date()): boolean {
  if (def.unlockKind !== "event" || !def.eventStart || !def.eventEnd) return false;
  const d = today.toISOString().slice(0, 10);
  return d >= def.eventStart && d <= def.eventEnd;
}

export async function equipFrame(id: FrameId): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;

  const { error } = await supabase.from("profiles").update({ equipped_frame: id }).eq("id", uid);
  return !error;
}

export async function claimEventFrame(id: FrameId): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_event_frame", { p_frame: id });
  if (error) return false;
  const ok = (data as unknown as { ok: boolean } | null)?.ok === true;
  if (ok) invalidatePrefix("profile:");
  return ok;
}
