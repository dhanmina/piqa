import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "piqa.rememberMe";
const EMAIL_KEY = "piqa.rememberedEmail";

/**
 * "Remember me" — whether a signed-in session should survive a cold app restart.
 *
 * The supabase client persists every session to AsyncStorage (persistSession is
 * global and can't be flipped per sign-in), so we can't stop the token being
 * written. Instead we record the user's choice here and, on the next cold launch,
 * clear a non-remembered session before it's ever treated as signed in (see
 * SessionProvider). Defaults to true — mobile users expect to stay signed in;
 * only an explicit opt-out (a shared device) persists false.
 */
export async function setRememberMe(remember: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, remember ? "1" : "0");
}

export async function getRememberMe(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  return v !== "0"; // unset → true
}

/** The email to prefill on the sign-in screen while "remember me" is on. */
export async function setRememberedEmail(email: string | null): Promise<void> {
  if (email && email.trim()) await AsyncStorage.setItem(EMAIL_KEY, email.trim());
  else await AsyncStorage.removeItem(EMAIL_KEY);
}

export async function getRememberedEmail(): Promise<string> {
  return (await AsyncStorage.getItem(EMAIL_KEY)) ?? "";
}
