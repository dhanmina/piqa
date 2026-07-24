/**
 * Barrel re-export — hooks in lib/hooks/archive.ts, services in
 * lib/services/archive.ts. This file keeps old @lib/archive imports working.
 */
export {
  ARCHIVE_KEY,
  deleteFreeShot,
  fetchArchive,
  toggleStar,
  type Archive,
  type ArchiveItem,
  type ArchiveType,
  type StarResult,
} from "./services/archive";
export { useArchive } from "./hooks/archive";
