import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { toThumbPath } from './photoPaths';

const QUEUE_DIR = FileSystem.documentDirectory + 'capture-queue/';
const QUEUE_INDEX = QUEUE_DIR + 'index.json';
// Grid/list views only ever render this size -- full-res is fetched on demand
// only when a photo is actually opened in the fullscreen viewer (see
// captureQueries.ts), so this is what most browsing actually downloads.
const THUMB_WIDTH = 480;
const THUMB_COMPRESS = 0.5;

type QueueItem = { localPath: string; themeTag?: string; capturedAt: string };

async function ensureQueueDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
}

async function readIndex(): Promise<QueueItem[]> {
  const info = await FileSystem.getInfoAsync(QUEUE_INDEX);
  if (!info.exists) return [];
  const raw = await FileSystem.readAsStringAsync(QUEUE_INDEX);
  return JSON.parse(raw);
}

async function writeIndex(items: QueueItem[]): Promise<void> {
  await FileSystem.writeAsStringAsync(QUEUE_INDEX, JSON.stringify(items));
}

// Local queueing (this function's own contract) must never throw — a photo that fails to
// even get queued locally is lost, so that's the one failure confirm() needs to react to.
// A failed *upload* is not an error here: the item just stays queued for the next
// processQueue() call, which is the offline-first design (see lib/captureQueue.ts docs).
export async function enqueueCapture(localUri: string, themeTag?: string): Promise<{ error: Error | null }> {
  try {
    await ensureQueueDir();
    const localPath = `${QUEUE_DIR}${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: localUri, to: localPath });
    const items = await readIndex();
    // Local date, not toISOString() — that's UTC, so the capture would land on the
    // wrong day for anyone whose local midnight isn't UTC midnight.
    const now = new Date();
    const capturedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    items.push({ localPath, themeTag, capturedAt });
    await writeIndex(items);
  } catch (error) {
    return { error: error as Error };
  }
  processQueue();
  return { error: null };
}

// Best-effort -- a missing thumbnail just means the grid falls back to the full-res
// file for this one photo, not a lost capture, so failure here must never affect
// the capture's own upload/insert or queue retry state.
async function uploadThumbnail(localPath: string, storagePath: string): Promise<void> {
  try {
    const manipulated = await ImageManipulator.manipulate(localPath).resize({ width: THUMB_WIDTH }).renderAsync();
    const thumb = await manipulated.saveAsync({ compress: THUMB_COMPRESS });
    const thumbBase64 = await FileSystem.readAsStringAsync(thumb.uri, { encoding: 'base64' });
    const { error } = await supabase.storage
      .from('captures')
      .upload(toThumbPath(storagePath), decode(thumbBase64), { contentType: 'image/jpeg' });
    if (error) console.error('[captureQueue] thumbnail upload failed', storagePath, error);
  } catch (error) {
    console.error('[captureQueue] thumbnail generation failed', storagePath, error);
  }
}

// Best-effort background sync — never throws, so a transient session/network failure
// here can't take down whatever called it (enqueueCapture, or a future app-foreground resync).
export async function processQueue(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const items = await readIndex();
    const remaining: QueueItem[] = [];
    for (const item of items) {
      const base64 = await FileSystem.readAsStringAsync(item.localPath, { encoding: 'base64' });
      const storagePath = `${user.id}/${item.capturedAt}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('captures')
        .upload(storagePath, decode(base64), { contentType: 'image/jpeg' });
      if (uploadError) { remaining.push(item); continue; }
      await uploadThumbnail(item.localPath, storagePath);
      const { error: insertError } = await supabase.from('captures').insert({
        user_id: user.id,
        storage_path: storagePath,
        theme_tag: item.themeTag ?? null,
        captured_at: item.capturedAt,
      });
      if (insertError) remaining.push(item);
    }
    await writeIndex(remaining);
  } catch {
    // transient — items already on disk stay queued and retry on the next call
  }
}
