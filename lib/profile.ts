import { supabase } from './supabase';

export type ProfileInfo = { display_name: string | null; avatar_url: string | null; created_at: string };
export type Stats = { current_count: number; longest_count: number };
export type MosaicPhoto = { url: string; capturedAt: string };

export async function fetchProfile(): Promise<{ data: ProfileInfo | null; error: Error | null }> {
  const { data, error } = await supabase.from('profiles').select('display_name, avatar_url, created_at').single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function fetchStats(): Promise<{ data: Stats | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('get_today_state');
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data?.[0] ?? null, error: null };
}

export async function fetchArchiveMosaic(): Promise<{ data: MosaicPhoto[]; error: Error | null }> {
  const { data, error } = await supabase.rpc('get_profile_mosaic');
  if (error) return { data: [], error: new Error(error.message) };

  const rows: { storage_path: string; captured_at: string }[] = data ?? [];
  if (rows.length === 0) return { data: [], error: null };

  const paths = rows.map((r) => r.storage_path);
  const { data: signed, error: signError } = await supabase.storage.from('captures').createSignedUrls(paths, 3600);
  if (signError) return { data: [], error: new Error(signError.message) };

  const urlByPath = new Map<string, string>();
  signed?.forEach((s) => {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  });
  const mosaic = rows
    .map((r) => ({ url: urlByPath.get(r.storage_path), capturedAt: r.captured_at }))
    .filter((p): p is MosaicPhoto => !!p.url);
  return { data: mosaic, error: null };
}

export async function updateDisplayName(name: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('Not signed in') };

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name.trim() })
    .eq('id', user.id)
    .select('id')
    .single();
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
