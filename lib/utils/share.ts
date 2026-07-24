import * as Sharing from "expo-sharing";
import type React from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

/**
 * The public link to a photo — mirrors the in-app /photo/[id] route.
 *
 * NOT included in shares yet, on purpose: there's no web landing at piqa.app and
 * no universal-link config, so the URL wouldn't resolve — a dead link is worse
 * than none. Wire it into shareCard (RN Share `message` on iOS; Android via the
 * OG/universal-link path) once piqa.app serves /photo/[id] with an OG preview and
 * the app declares associatedDomains / assetlinks.
 */
export function photoShareUrl(id: string): string {
  return `https://piqa.app/photo/${id}`;
}

/**
 * Snapshot a composed ShareCard view to a PNG and hand it to the OS share sheet.
 * Image-only for now — the card is self-branded (its rail says PIQA), so it needs
 * no link, and there's no web target to link to yet. Captured at the view's size ×
 * the device pixel ratio (a 360pt card is ~720–1080px). Returns "unavailable" when
 * the platform has no share sheet; throws on a real capture failure.
 */
export async function shareCard(ref: React.RefObject<View | null>): Promise<"shared" | "unavailable"> {
  const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share your shot" });
  return "shared";
}
