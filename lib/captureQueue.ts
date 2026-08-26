import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const QUEUE_DIR = FileSystem.documentDirectory + 'capture-queue/';
const QUEUE_INDEX = QUEUE_DIR + 'index.json';

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

export async function enqueueCapture(localUri: string, themeTag?: string): Promise<void> {
  await ensureQueueDir();
  const localPath = `${QUEUE_DIR}${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: localUri, to: localPath });
  const items = await readIndex();
  items.push({ localPath, themeTag, capturedAt: new Date().toISOString().slice(0, 10) });
  await writeIndex(items);
  await processQueue();
}

export async function processQueue(): Promise<void> {
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
    const { error: insertError } = await supabase.from('captures').insert({
      user_id: user.id,
      storage_path: storagePath,
      theme_tag: item.themeTag ?? null,
      captured_at: item.capturedAt,
    });
    if (insertError) remaining.push(item);
  }
  await writeIndex(remaining);
}
