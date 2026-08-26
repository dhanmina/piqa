import { supabase } from './supabase';

export async function saveIntentTheme(theme: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ intent_theme: theme }).eq('id', user.id);
}

export async function markOnboardingComplete(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id);
}

export async function getOnboardingStatus(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('onboarded_at').eq('id', user.id).single();
  return !!data?.onboarded_at;
}
