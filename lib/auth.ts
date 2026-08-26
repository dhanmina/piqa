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

  const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
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

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  return { error };
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
