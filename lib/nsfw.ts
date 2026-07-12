import { getConfig } from "./config";

/**
 * On-device NSFW pre-upload gate (spec §12). This is the PLUGGABLE INTERFACE:
 * the real NSFWJS / tfjs-react-native model plugs in via setNsfwClassifier after
 * a feasibility spike (Expo 57 / new-architecture native-binding risk). Until
 * then the default classifier passes everything, and a dev override exercises
 * the block path. The guarantee this file upholds: flagged bytes are decided
 * BEFORE any upload, so a flagged shot is never sent (see captureQueue).
 */

export const NSFW_REJECTION_COPY =
  "This shot didn't pass Piqa's content check. Piqa stays nudity and gore free. Try another shot.";

/** Returns an NSFW probability in [0, 1]. */
type Classifier = (uri: string) => Promise<number>;

let classifier: Classifier = async () => 0; // stub: everything passes
export function setNsfwClassifier(fn: Classifier) {
  classifier = fn;
}

// Dev-only lever so the block path is testable before the real model lands.
let devForceBlock = false;
export function setNsfwDevForceBlock(v: boolean) {
  devForceBlock = v;
}
export function getNsfwDevForceBlock() {
  return devForceBlock;
}

export type NsfwResult = { flagged: boolean; score: number };

export async function classifyImage(uri: string): Promise<NsfwResult> {
  if (devForceBlock) return { flagged: true, score: 1 };
  const threshold = await getConfig("nsfw_threshold");
  // Fail-open: a classifier bug must never block a legitimate capture (the
  // offline-first promise — capture never fails). The real model runs reliably
  // on-device; a crash here degrades to "allow", not "reject".
  const score = await classifier(uri).catch(() => 0);
  return { flagged: score >= threshold, score };
}
