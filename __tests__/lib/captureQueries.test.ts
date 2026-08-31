import { QueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getSignedUrls } from '../../lib/signedUrlCache';
import { queryKeys, fetchTodayCaptures, invalidateCaptureQueries } from '../../lib/captureQueries';

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

jest.mock('../../lib/signedUrlCache', () => ({
  getSignedUrls: jest.fn(),
}));

jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn() } }));

function mockCapturesQuery(resultsByCall: { data: { id: string; storage_path: string }[] }[]) {
  let call = 0;
  (supabase.from as jest.Mock).mockReturnValue({
    select: function () {
      return this;
    },
    eq: function () {
      return this;
    },
    order: function () {
      const result = resultsByCall[Math.min(call, resultsByCall.length - 1)];
      call += 1;
      return Promise.resolve(result);
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('queryKeys.todayCaptures builds a key scoped to the date', () => {
  expect(queryKeys.todayCaptures('2026-09-01')).toEqual(['todayCaptures', '2026-09-01']);
});

test('fetchTodayCaptures resolves signed urls for the rows returned', async () => {
  mockCapturesQuery([{ data: [{ id: 'c1', storage_path: 'p1' }, { id: 'c2', storage_path: 'p2' }] }]);
  (getSignedUrls as jest.Mock).mockResolvedValue(
    new Map([
      ['p1', 'https://signed/p1'],
      ['p2', 'https://signed/p2'],
    ])
  );

  const result = await fetchTodayCaptures('2026-09-01');

  expect(supabase.from).toHaveBeenCalledWith('captures');
  expect(result).toEqual({
    ids: ['c1', 'c2'],
    urls: ['https://signed/p1', 'https://signed/p2'],
    count: 2,
  });
});

test('fetchTodayCaptures drops rows whose signed url failed to resolve, but keeps the raw count', async () => {
  mockCapturesQuery([{ data: [{ id: 'c1', storage_path: 'p1' }, { id: 'c2', storage_path: 'p2' }] }]);
  (getSignedUrls as jest.Mock).mockResolvedValue(new Map([['p1', 'https://signed/p1']]));

  const result = await fetchTodayCaptures('2026-09-01');

  expect(result).toEqual({ ids: ['c1'], urls: ['https://signed/p1'], count: 2 });
});

test('fetchTodayCaptures retries when the row has not landed yet, then returns it once it has', async () => {
  jest.useFakeTimers();
  mockCapturesQuery([{ data: [] }, { data: [{ id: 'c1', storage_path: 'p1' }] }]);
  (getSignedUrls as jest.Mock).mockResolvedValue(new Map([['p1', 'https://signed/p1']]));

  const promise = fetchTodayCaptures('2026-09-01');
  await jest.advanceTimersByTimeAsync(1500);
  const result = await promise;

  expect(result).toEqual({ ids: ['c1'], urls: ['https://signed/p1'], count: 1 });
  jest.useRealTimers();
});

test('fetchTodayCaptures gives up after 3 empty attempts', async () => {
  jest.useFakeTimers();
  mockCapturesQuery([{ data: [] }]);

  const promise = fetchTodayCaptures('2026-09-01');
  await jest.advanceTimersByTimeAsync(1500);
  await jest.advanceTimersByTimeAsync(1500);
  const result = await promise;

  expect(result).toEqual({ ids: [], urls: [], count: 0 });
  jest.useRealTimers();
});

test('invalidateCaptureQueries invalidates the todayCaptures, timelineMonth and recap key families', () => {
  const client = new QueryClient();
  const spy = jest.spyOn(client, 'invalidateQueries');

  invalidateCaptureQueries(client);

  expect(spy).toHaveBeenCalledWith({ queryKey: ['todayCaptures'] });
  expect(spy).toHaveBeenCalledWith({ queryKey: ['timelineMonth'] });
  expect(spy).toHaveBeenCalledWith({ queryKey: ['recap'] });
});
