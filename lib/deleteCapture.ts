import { supabase } from './supabase';

export async function deleteCapture(captureId: string): Promise<{ error: Error | null }> {
  const { data: storagePath, error: rpcError } = await supabase.rpc('delete_capture', { p_capture_id: captureId });
  if (rpcError) return { error: rpcError };

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('captures').remove([storagePath]);
    // The DB row is already gone at this point -- an orphaned storage object here
    // is a harmless leak (wasted storage), not a correctness bug, so it does not
    // propagate as an error to the caller.
    if (storageError) console.error('[deleteCapture] storage removal failed', storagePath, storageError);
  }

  return { error: null };
}
