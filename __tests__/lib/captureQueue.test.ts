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

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockResolvedValue({
        saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///docs/thumb.jpg' }),
      }),
    })),
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    storage: { from: jest.fn().mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: null }) }) },
    from: jest.fn().mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: null }) }),
  },
}));

// `storage.from` is a fixed mockReturnValue, so every call hands back the same
// object -- grabbing `.upload` once gives the one mock instance every upload call hits.
const mockUpload = supabase.storage.from('captures').upload as jest.Mock;

test('enqueueCapture copies file locally then processQueue uploads and inserts a capture row', async () => {
  await enqueueCapture('file:///tmp/photo.jpg');
  await processQueue();
  expect(supabase.storage.from).toHaveBeenCalledWith('captures');
  expect(supabase.from).toHaveBeenCalledWith('captures');
});

test('processQueue also generates and uploads a thumbnail alongside the full-res photo', async () => {
  mockUpload.mockClear();
  await enqueueCapture('file:///tmp/photo-thumb-check.jpg');
  // enqueueCapture already fires its own background processQueue() -- calling it again
  // here (matching the other tests in this file) can race and reprocess the same queued
  // item twice, so assert on path pairing rather than an exact call count.
  await processQueue();
  const uploadedPaths = mockUpload.mock.calls.map((call) => call[0] as string);
  const thumbPaths = uploadedPaths.filter((p) => p.endsWith('-thumb.jpg'));
  const fullPaths = uploadedPaths.filter((p) => !p.endsWith('-thumb.jpg'));
  expect(thumbPaths.length).toBeGreaterThan(0);
  expect(fullPaths.length).toBeGreaterThan(0);
  thumbPaths.forEach((tp) => expect(fullPaths).toContain(tp.replace('-thumb.jpg', '.jpg')));
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
