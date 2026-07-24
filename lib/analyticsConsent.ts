import AsyncStorage from "@react-native-async-storage/async-storage";

import { hasOptedOut, optInAnalytics, optOutAnalytics } from "./services/analytics";

const CONSENT_KEY = "analytics_consent";

/**
 * Whether the user has made an analytics consent decision. When false, the
 * consent modal should be shown on first meaningful screen.
 */
export async function hasConsentRecord(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(CONSENT_KEY);
    return v !== null;
  } catch {
    return false;
  }
}

/** Record the user's analytics consent choice and apply it. */
export async function setConsent(granted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, granted ? "1" : "0");
  } catch {
    // best-effort
  }
  if (granted) await optInAnalytics();
  else await optOutAnalytics();
}

/** Current consent state for the Settings toggle. Reads the real PostHog state. */
export function getConsentSync(): boolean {
  return !hasOptedOut();
}
