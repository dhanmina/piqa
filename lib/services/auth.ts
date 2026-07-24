import { supabase } from "./supabase";

/**
 * Get the current user's id without a React hook — for use in plain async
 * functions (moderation, profile, admin, etc.). Returns null when signed out.
 */
export async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
