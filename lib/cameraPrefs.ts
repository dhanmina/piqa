import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local-only camera preferences (Settings > Camera & Capture): grid overlay
 * and front-camera mirroring. Same shape as analyticsConsent.ts/uploadPrefs.ts
 * — sync in-memory mirror + AsyncStorage persistence, no server round trip.
 * The camera screen is always a fresh mount when opened, so a sync read at
 * mount is enough; no live-update wiring needed.
 */
const GRID_KEY = "piqa.cameraPrefs.grid";
const MIRROR_KEY = "piqa.cameraPrefs.mirror";

let gridCache = false;
let mirrorCache = false;
void AsyncStorage.getItem(GRID_KEY).then((v) => {
  gridCache = v === "1";
});
void AsyncStorage.getItem(MIRROR_KEY).then((v) => {
  mirrorCache = v === "1";
});

export function getGridEnabledSync(): boolean {
  return gridCache;
}

export async function setGridEnabled(value: boolean): Promise<void> {
  gridCache = value;
  try {
    await AsyncStorage.setItem(GRID_KEY, value ? "1" : "0");
  } catch {
    // best-effort
  }
}

export function getMirrorEnabledSync(): boolean {
  return mirrorCache;
}

export async function setMirrorEnabled(value: boolean): Promise<void> {
  mirrorCache = value;
  try {
    await AsyncStorage.setItem(MIRROR_KEY, value ? "1" : "0");
  } catch {
    // best-effort
  }
}
