import * as Sharing from "expo-sharing";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

/**
 * Snapshot a composed ShareCard view to a PNG and hand it to the OS share sheet.
 * The card is captured at the view's on-screen size × the device pixel ratio, so a
 * 360pt card is ~720–1080px — sharp enough for Stories and messages. Returns
 * "unavailable" when the platform has no share sheet (rare); throws on a real
 * capture/encode failure so the caller can surface a retry.
 */
export async function shareCardImage(node: View): Promise<"shared" | "unavailable"> {
  const uri = await captureRef(node, { format: "png", quality: 1, result: "tmpfile" });
  if (!(await Sharing.isAvailableAsync())) return "unavailable";
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: "Share your shot",
  });
  return "shared";
}
