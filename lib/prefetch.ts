import { fetchKey } from "./cache";
import { loadGallery } from "./gallery";
import { HOME_KEY, fetchHomeState } from "./homeState";

/**
 * Warm the first screens in the background right after login / session restore,
 * so the initial tab renders from cache instead of a skeleton. Best-effort and
 * deduped by the cache layer, so calling it repeatedly is cheap and safe.
 */
export async function prefetchEssentials(): Promise<void> {
  await Promise.allSettled([
    fetchKey(HOME_KEY, fetchHomeState),
    fetchKey("gallery:latest", () => loadGallery(null)),
  ]);
}
