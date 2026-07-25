import * as Sharing from "expo-sharing";
import type React from "react";
import { Share as RNShare, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { capture } from "@lib/services/analytics";

const DOMAIN = "https://joinpiqa.com";

/**
 * The public link to a photo — mirrors the in-app /photo/[id] route.
 *
 * NOT included in shares yet, on purpose: there's no web landing at joinpiqa.com and
 * no universal-link config, so the URL wouldn't resolve — a dead link is worse
 * than none. Wire it into shareCard (RN Share `message` on iOS; Android via the
 * OG/universal-link path) once joinpiqa.com serves /photo/[id] with an OG preview and
 * the app declares associatedDomains / assetlinks.
 */
export function photoShareUrl(id: string): string {
  return `${DOMAIN}/photo/${id}`;
}

/** The public link to a user's profile. */
export function profileShareUrl(username: string): string {
  return `${DOMAIN}/u/${username}`;
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

/** Share a profile link via the OS share sheet. Returns "shared" or "unavailable". */
export async function shareProfile(username: string): Promise<"shared" | "unavailable"> {
  const url = profileShareUrl(username);
  const result = await RNShare.share({ message: url });
  if (result.action === RNShare.sharedAction) {
    capture("profile_shared", { username });
    return "shared";
  }
  return "unavailable";
}
