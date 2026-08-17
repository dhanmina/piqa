/**
 * "Clear cache" (Settings > Data & Storage). Scoped to what's honestly
 * measurable and safe to wipe: expo-file-system's Paths.cache — NOT
 * Paths.document/captures, which is the durable offline capture queue and
 * must never be touched. expo-image's own disk cache has no size API (v57),
 * so it's cleared but not counted in the shown size.
 */
import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";

function sizeOf(entry: File | Directory): number {
  if (entry instanceof File) return entry.size ?? 0;
  try {
    return entry.list().reduce((sum, child) => sum + sizeOf(child), 0);
  } catch {
    return 0;
  }
}

export function getCacheSize(): number {
  try {
    return Paths.cache.list().reduce((sum, entry) => sum + sizeOf(entry), 0);
  } catch {
    return 0;
  }
}

export async function clearCache(): Promise<void> {
  try {
    for (const entry of Paths.cache.list()) {
      try {
        entry.delete();
      } catch {
        // best-effort per-entry — a locked/in-use file shouldn't block the rest
      }
    }
  } catch {
    // best-effort
  }
  try {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();
  } catch {
    // best-effort
  }
}
