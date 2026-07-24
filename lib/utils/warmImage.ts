import { Image } from "expo-image";

import { imageCacheKey } from "../cache";

/**
 * Warm the expo-image disk cache for a URL so it renders instantly when the
 * component mounts. Deduplicates concurrent calls for the same URL. Fire-and-
 * forget — failures are best-effort (the image will just load normally).
 */
export function warmImage(uri: string | null | undefined): void {
  if (!uri) return;
  void Image.loadAsync({ uri, cacheKey: imageCacheKey(uri) }).catch(() => {});
}
