import { enqueueCapture, processQueue } from '../../lib/captureQueue';
import { supabase } from '../../lib/supabase';

jest.mock('expo-file-system/legacy', () => {
  const store: Record<string, string> = {};
  return {
    documentDirectory: 'file:///docs/',
    copyAsync: jest.fn(async ({ to }: { to: string }) => {
      store[to] = 'photo-base64';
    }),
    getInfoAsync: jest.fn(async (path: string) => ({ exists: path in store })),
    readAsStringAsync: jest.fn(async (path: string) => store[path] ?? ''),
    writeAsStringAsync: jest.fn(async (path: string, contents: string) => {
      store[path] = contents;
    }),
    makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn().mockReturnValue(new ArrayBuffer(4)),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    storage: { from: jest.fn().mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: null }) }) },
    from: jest.fn().mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: null }) }),
  },
}));

test('enqueueCapture copies file locally then processQueue uploads and inserts a capture row', async () => {
  await enqueueCapture('file:///tmp/photo.jpg');
  await processQueue();
  expect(supabase.storage.from).toHaveBeenCalledWith('captures');
  expect(supabase.from).toHaveBeenCalledWith('captures');
});

test('enqueueCapture still resolves (photo stays queued for retry) when the background sync throws', async () => {
  (supabase.auth.getUser as jest.Mock).mockRejectedValueOnce(new Error('network down'));

  const result = await enqueueCapture('file:///tmp/photo2.jpg');

  expect(result.error).toBeNull();
});

test('enqueueCapture resolves with an error when the photo cannot even be queued locally', async () => {
  const { copyAsync } = jest.requireMock('expo-file-system/legacy');
  (copyAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

  const result = await enqueueCapture('file:///tmp/photo3.jpg');

  expect(result.error).toBeInstanceOf(Error);
});
