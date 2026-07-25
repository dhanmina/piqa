import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "piqa.onboardingComplete";
const FIRST_SHOT_KEY = "piqa.firstShotComplete";

/**
 * First-launch onboarding is a once-per-device intro (the daily loop + the two
 * reasoned permission asks), shown before the auth screen and never again. The
 * flag is device-local, not tied to a session: it gates the pre-auth intro, so a
 * signed-out returning user skips straight to auth. Defaults to false — a fresh
 * install has seen nothing.
 */
export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}

export async function getOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "1";
}

/**
 * First-shot aha is a once-per-device post-signup experience: the user takes a
 * practice shot and watches it develop into a framed print. Shown after the first
 * signup, never again. Device-local — a returning user on a new device skips it.
 */
export async function setFirstShotComplete(): Promise<void> {
  await AsyncStorage.setItem(FIRST_SHOT_KEY, "1");
}

export async function getFirstShotComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(FIRST_SHOT_KEY)) === "1";
}
