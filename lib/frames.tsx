/**
 * Barrel re-export — hooks in lib/hooks/frames.tsx, services in
 * lib/services/frames.ts. This file keeps old @lib/frames imports working.
 */
export {
  BOOTSTRAP,
  DEFAULT_FRAME_DEF,
  asFrameId,
  asStatus,
  claimEventFrame,
  equipFrame,
  frameClaimable,
  frameForDate,
  frameOwned,
  fetchCatalog,
  type FrameDef,
  type FrameId,
  type MarkerShape,
  type PhotoStatus,
} from "./services/frames";
export {
  FrameCatalogProvider,
  useFrameCatalog,
  useFrameDef,
  useFrameForDate,
} from "./hooks/frames";
