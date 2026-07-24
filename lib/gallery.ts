/**
 * Barrel re-export — the hooks live in lib/hooks/useGallery.ts and the service
 * functions in lib/services/gallery.ts. This file keeps old `@lib/gallery`
 * imports working during the migration.
 */
export { useSignedThumb } from "./hooks/useCache";
export { isRevealSeen, isResultSeen, loadGallery, loadFollowingGallery, markRevealSeen, markResultSeen, type GalleryDetailPhoto, type GalleryFeed } from "./services/gallery";
export { useGallery, useFollowingGallery, useGalleryHearts } from "./hooks/useGallery";
