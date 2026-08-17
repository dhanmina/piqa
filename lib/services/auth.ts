import { GoogleSignin } from "@react-native-google-signin/google-signin";

import { reportError } from "./sentry";
import { supabase } from "./supabase";

/**
 * Get the current user's id without a React hook — for use in plain async
 * functions (moderation, profile, admin, etc.). Returns null when signed out.
 */
export async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

let googleConfigured = false;

/**
 * Google native sign-in: no redirect, no client secret — the SDK hands back an
 * ID token and Supabase verifies it directly (signInWithIdToken). A new user
 * lands on handle_new_user's existing email-derived username fallback, so
 * there's no separate "claim your username" step to build.
 *
 * Returns null on a plain user cancel (not an error — don't toast it, don't
 * report it); throws on a real failure so the caller's existing
 * friendlyError() path handles it, after logging it to Sentry with which
 * step failed (this is a black-box native SDK on a wide range of Android
 * devices/Play Services versions — "it broke" alone won't be enough to debug).
 */
export async function signInWithGoogle(): Promise<void | null> {
  let step = "configure";
  try {
    if (!googleConfigured) {
      GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
      googleConfigured = true;
    }
    step = "hasPlayServices";
    await GoogleSignin.hasPlayServices();
    step = "signIn";
    const result = await GoogleSignin.signIn();
    if (result.type !== "success") return null; // user backed out of the picker
    step = "missingIdToken";
    const idToken = result.data.idToken;
    if (!idToken) throw new Error("Google sign-in did not return a token.");
    step = "signInWithIdToken";
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    if (error) throw error;
  } catch (e) {
    reportError(e, { flow: "google_signin", step });
    throw e;
  }
}
