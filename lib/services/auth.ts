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
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    // Log the actual runtime value, not just "it's set in .env.local" — env
    // vars silently threading through wrong (undefined, stale bundle, wrong
    // EAS environment) looks identical to a real registration failure once
    // it hits GoogleSignin, so this needs to be provably correct at the point
    // of use, not assumed from the build config.
    console.log(`[auth] google sign-in: configuring with webClientId=${webClientId ?? "(undefined!)"}`);
    if (!googleConfigured) {
      GoogleSignin.configure({ webClientId });
      googleConfigured = true;
    }

    step = "hasPlayServices";
    const hasPlay = await GoogleSignin.hasPlayServices();
    console.log(`[auth] google sign-in: hasPlayServices=${hasPlay}`);

    step = "signIn";
    console.log("[auth] google sign-in: opening picker…");
    const result = await GoogleSignin.signIn();
    console.log(`[auth] google sign-in: picker result type=${result.type}`);
    if (result.type !== "success") return null; // user backed out of the picker

    step = "missingIdToken";
    const idToken = result.data.idToken;
    console.log(`[auth] google sign-in: got idToken=${idToken ? `yes (${idToken.length} chars)` : "NO"}`);
    if (!idToken) throw new Error("Google sign-in did not return a token.");

    step = "signInWithIdToken";
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
    console.log(`[auth] google sign-in: signInWithIdToken error=${error ? error.message : "none"}`);
    if (error) throw error;

    console.log("[auth] google sign-in: success");
  } catch (e) {
    // Log every field a GMS error can carry — `code` is the one that actually
    // distinguishes failure modes (DEVELOPER_ERROR vs SIGN_IN_REQUIRED vs
    // NETWORK_ERROR etc), but console.warn's default Error formatting hides it.
    const code = e && typeof e === "object" && "code" in e ? (e as { code?: unknown }).code : undefined;
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[auth] google sign-in failed at "${step}" — code=${code ?? "none"}:`, message, e);
    reportError(e, { flow: "google_signin", step, code });
    throw e;
  }
}
