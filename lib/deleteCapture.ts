import { supabase } from './supabase';
import { toThumbPath } from './photoPaths';

// The Supabase client has no request timeout configured, so a stalled connection
// (dropped packet, flaky mobile network) leaves an awaited call pending forever --
// with no timeout here, that showed up as a delete spinner that never resolves.
const TIMEOUT_MS = 15000;

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), TIMEOUT_MS)),
  ]);
}

export async function deleteCapture(captureId: string): Promise<{ error: Error | null }> {
  let storagePath: string | null;
  let rpcError: Error | null;
  try {
    ({ data: storagePath, error: rpcError } = await withTimeout(
      supabase.rpc('delete_capture', { p_capture_id: captureId }),
      'delete_capture'
    ));
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
  if (rpcError) return { error: rpcError };

  if (storagePath) {
    try {
      // Thumbnail may not exist for captures uploaded before thumbnails shipped --
      // remove() on a missing key is a no-op, not an error, so this is safe either way.
      const { error: storageError } = await withTimeout(
        supabase.storage.from('captures').remove([storagePath, toThumbPath(storagePath)]),
        'storage remove'
      );
      // The DB row is already gone at this point -- an orphaned storage object here
      // is a harmless leak (wasted storage), not a correctness bug, so it does not
      // propagate as an error to the caller.
      if (storageError) console.error('[deleteCapture] storage removal failed', storagePath, storageError);
    } catch (err) {
      console.error('[deleteCapture] storage removal timed out', storagePath, err);
    }
  }

  return { error: null };
}
