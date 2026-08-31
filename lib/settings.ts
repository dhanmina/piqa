import { supabase } from './supabase';

export type AccountInfo = { email: string; canChangePassword: boolean };

export async function fetchAccountInfo(): Promise<{ data: AccountInfo | null; error: Error | null }> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { data: null, error: new Error(error.message) };

  const user = data.user;
  if (!user || !user.email) return { data: null, error: new Error('Not signed in') };

  return {
    data: { email: user.email, canChangePassword: user.app_metadata?.provider === 'email' },
    error: null,
  };
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}
