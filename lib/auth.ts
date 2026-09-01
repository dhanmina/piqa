import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

// Required once at module load so a completed OAuth redirect actually
// resolves openAuthSessionAsync's promise instead of hanging.
WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { error };

  let result;
  try {
    result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
  if (result.type !== 'success' || !('url' in result)) {
    return { error: null }; // user cancelled the browser — not a hard error
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) return { error: new Error(errorCode) };

  const { access_token, refresh_token } = params;
  if (!access_token) return { error: new Error('No access token in OAuth redirect') };

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  return { error: sessionError };
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export async function signUpWithEmail(email: string, password: string, username: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: username.toLowerCase() } },
  });
  return { error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function requestPasswordReset(email: string) {
  const redirectTo = Linking.createURL('reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error };
}

// The hosted project's recovery email sends a 6-digit code ({{ .Token }} in the
// dashboard template), not a working deep link -- verifyOtp exchanges it for a real
// session directly, no redirect-URL allowlist or deep-link handling needed at all.
export async function verifyPasswordResetCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  return { error };
}

// Called from app/reset-password.tsx with whatever URL the recovery email link opened
// the app with (cold Linking.getInitialURL() or a warm 'url' event) — same manual
// token-extraction as signInWithGoogle above, since RN has no window.location for
// supabase-js's web-only detectSessionInUrl to read off of automatically.
//
// Checks params.error directly rather than QueryParams' own `errorCode` return value —
// that only ever reads a literal `errorCode` query param, which doesn't match GoTrue's
// actual `error`/`error_code`/`error_description` redirect format (an expired or
// already-used recovery link redirects with those, e.g. `#error=access_denied&error_code=otp_expired`).
export async function completePasswordReset(url: string) {
  const { params } = QueryParams.getQueryParams(url);
  if (params.error) return { error: new Error(params.error_description || params.error) };
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return { error: new Error('Invalid or expired reset link.') };
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return { error };
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
