import { ARCHIVE_KEY, fetchArchive } from "./archive";
import { fetchKey } from "./cache";
import { loadGallery } from "./gallery";
import { HOME_KEY, fetchHomeState } from "./homeState";
import { fetchProfile, profileKey } from "./profile";

/**
 * Warm the first screens in the background right after login / session restore,
 * so a tab renders from cache instead of a skeleton the first time it's opened.
 * Best-effort and deduped by the cache layer, so calling it repeatedly is cheap
 * and safe. Profile is included so "you" is ready the moment you tap the tab.
 */
export async function prefetchEssentials(): Promise<void> {
  await Promise.allSettled([
    fetchKey(HOME_KEY, fetchHomeState),
    fetchKey("gallery:latest", () => loadGallery(null)),
    fetchKey(profileKey(null), () => fetchProfile(null)),
    fetchKey(ARCHIVE_KEY, fetchArchive),
  ]);
}
