import { supabase } from './supabase';
import { toThumbPath } from './photoPaths';

// Same reasoning as lib/deleteCapture.ts -- the client has no request timeout
// configured, so a stalled connection would otherwise leave the delete spinner
// (and this irreversible action) pending forever.
const TIMEOUT_MS = 15000;

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), TIMEOUT_MS)),
  ]);
}

export type AccountInfo = { email: string; canChangePassword: boolean };

export async function fetchAccountInfo(): Promise<{ data: AccountInfo | null; error: Error | null }> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { data: null, error: new Error(error.message) };

  const user = data.user;
  if (!user || !user.email) return { data: null, error: new Error('Not signed in') };

  // Checks every linked identity, not just app_metadata.provider (the *primary* one) --
  // an account signed up via Google that later links email/password would otherwise be
  // wrongly told it has no password to change. Latent today (this app has no
  // identity-linking flow yet, so every account has exactly one identity), but wrong on
  // its own terms and cheap to get right before linking ever ships.
  const canChangePassword = (user.identities ?? []).some((identity) => identity.provider === 'email');

  return {
    data: { email: user.email, canChangePassword },
    error: null,
  };
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

// Permanently deletes the signed-in user: the RPC removes auth.users (every DB
// row -- profile, captures, streak, buddy links -- cascades from that FK, see
// 0032_delete_own_account.sql) and hands back each capture's storage_path so
// this can also clear the actual bucket objects, which the FK graph can't reach.
// A leftover storage object on partial failure is a harmless orphan (wasted
// space), not a correctness bug, so it's logged rather than surfaced -- the
// account is already gone by the time storage cleanup runs.
export async function deleteOwnAccount(): Promise<{ error: Error | null }> {
  // Fetched before the RPC runs, not after -- once delete_own_account deletes
  // auth.users, getUser()'s round trip to the auth API has nothing left to
  // find. The access token itself stays valid for the storage calls below
  // (JWTs aren't re-checked against the users row per request), only this
  // lookup needs to happen first.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: new Error('Not signed in') };

  let capturePaths: string[] | null;
  let rpcError: Error | null;
  try {
    ({ data: capturePaths, error: rpcError } = await withTimeout(
      supabase.rpc('delete_own_account'),
      'delete_own_account'
    ));
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
  if (rpcError) return { error: rpcError };

  const objectPaths = (capturePaths ?? []).flatMap((path) => [path, toThumbPath(path)]);
  if (objectPaths.length > 0) {
    try {
      const { error: storageError } = await withTimeout(
        supabase.storage.from('captures').remove(objectPaths),
        'captures storage remove'
      );
      if (storageError) console.error('[deleteOwnAccount] captures storage removal failed', storageError);
    } catch (err) {
      console.error('[deleteOwnAccount] captures storage removal timed out', err);
    }
  }

  try {
    // Fixed path convention from lib/profile.ts uploadAvatar -- one file per
    // user, no lookup needed. remove() on a missing key is a no-op.
    const { error: avatarError } = await withTimeout(
      supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]),
      'avatar storage remove'
    );
    if (avatarError) console.error('[deleteOwnAccount] avatar storage removal failed', avatarError);
  } catch (err) {
    console.error('[deleteOwnAccount] avatar storage removal timed out', err);
  }

  return { error: null };
}
