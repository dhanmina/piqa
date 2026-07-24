import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "piqa.onboardingComplete";

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
