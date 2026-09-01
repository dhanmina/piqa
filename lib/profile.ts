import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export type ProfileInfo = { username: string; display_name: string | null; avatar_url: string | null };

export async function fetchProfile(): Promise<{ data: ProfileInfo | null; error: Error | null }> {
  const { data, error } = await supabase.from('profiles').select('username, display_name, avatar_url').single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function checkUsernameAvailable(username: string): Promise<{ data: boolean | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('is_username_available', { check_username: username.toLowerCase() });
  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function setUsername(username: string): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('Not signed in') };

  const { error } = await supabase
    .from('profiles')
    .update({ username: username.trim().toLowerCase(), needs_username: false })
    .eq('id', user.id)
    .select('id')
    .single();
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function uploadAvatar(localUri: string): Promise<{ url: string | null; error: Error | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: new Error('Not signed in') };

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  // Fixed path (one avatar per user, overwritten in place) rather than a
  // timestamped path per capture — an old avatar file never lingers as an
  // orphan the way a stale streak-buddy avatar reference would.
  const path = `${user.id}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });
  if (uploadError) return { url: null, error: new Error(uploadError.message) };

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // The path is fixed, so the CDN/image cache would otherwise keep serving the
  // old bytes under the same URL after a re-upload — a version query busts it.
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', user.id)
    .select('id')
    .single();
  if (updateError) return { url: null, error: new Error(updateError.message) };
  return { url, error: null };
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
