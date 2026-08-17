import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * "Upload over Wi-Fi only" — a local device preference, not synced to the
 * server (unlike notifPrefs, which the server needs to decide what to send).
 * The capture queue reads it before draining, same on/off shape as
 * analyticsConsent.ts: sync in-memory mirror + AsyncStorage persistence.
 */
const WIFI_ONLY_KEY = "piqa.uploadPrefs.wifiOnly";

let wifiOnlyCache = false;
void AsyncStorage.getItem(WIFI_ONLY_KEY).then((v) => {
  wifiOnlyCache = v === "1";
});

/** Sync read for the Settings toggle's initial render. */
export function getWifiOnlySync(): boolean {
  return wifiOnlyCache;
}

export async function setWifiOnly(value: boolean): Promise<void> {
  wifiOnlyCache = value;
  try {
    await AsyncStorage.setItem(WIFI_ONLY_KEY, value ? "1" : "0");
  } catch {
    // best-effort
  }
}
