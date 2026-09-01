// __tests__/lib/recapShares.test.ts
import { supabase } from '../../lib/supabase';
import { createRecapShare, listRecapShares, revokeRecapShare, recapShareUrl } from '../../lib/recapShares';

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('recapShareUrl builds a public link from a share id', () => {
  expect(recapShareUrl('abc-123')).toBe('https://joinpiqa.com/r/abc-123');
});

test('createRecapShare inserts a row scoped to the current user and week range', async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } } });
  const insert = jest.fn().mockReturnThis();
  const select = jest.fn().mockReturnThis();
  const single = jest.fn().mockResolvedValue({
    data: { id: 's1', kind: 'week', created_at: '2026-09-02T00:00:00Z', revoked_at: null },
    error: null,
  });
  (supabase.from as jest.Mock).mockReturnValue({ insert, select, single });

  const { data, error } = await createRecapShare('week');

  expect(error).toBeNull();
  expect(data).toEqual({ id: 's1', kind: 'week', createdAt: '2026-09-02T00:00:00Z', revokedAt: null });
  expect(supabase.from).toHaveBeenCalledWith('recap_shares');
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'u1', kind: 'week' })
  );
});

test('createRecapShare freezes range_start/range_end using local dates, not UTC', async () => {
  const originalTZ = process.env.TZ;
  // A timezone ahead of UTC, frozen at a local early-morning moment where the
  // UTC calendar date is still "yesterday" -- this is exactly the case that
  // toISOString()-based range computation gets wrong (see 187168c and the
  // rangeFor() comment in lib/recapShares.ts).
  process.env.TZ = 'Asia/Manila';
  jest.useFakeTimers().setSystemTime(new Date('2026-09-01T17:30:00Z')); // local: 2026-09-02 01:30

  try {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } } });
    const insert = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const single = jest.fn().mockResolvedValue({
      data: { id: 's1', kind: 'week', created_at: '2026-09-02T00:00:00Z', revoked_at: null },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({ insert, select, single });

    await createRecapShare('week');

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ range_start: '2026-08-27', range_end: '2026-09-02' })
    );
  } finally {
    jest.useRealTimers();
    process.env.TZ = originalTZ;
  }
});

test('createRecapShare surfaces an insert error', async () => {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'u1' } } });
  const insert = jest.fn().mockReturnThis();
  const select = jest.fn().mockReturnThis();
  const single = jest.fn().mockResolvedValue({ data: null, error: new Error('boom') });
  (supabase.from as jest.Mock).mockReturnValue({ insert, select, single });

  const { data, error } = await createRecapShare('year');

  expect(data).toBeNull();
  expect(error).toEqual(new Error('boom'));
});

test('listRecapShares returns mapped rows ordered newest first', async () => {
  const order = jest.fn().mockResolvedValue({
    data: [
      { id: 's2', kind: 'year', created_at: '2026-09-02T00:00:00Z', revoked_at: null },
      { id: 's1', kind: 'week', created_at: '2026-09-01T00:00:00Z', revoked_at: '2026-09-01T01:00:00Z' },
    ],
    error: null,
  });
  const select = jest.fn().mockReturnThis();
  (supabase.from as jest.Mock).mockReturnValue({ select, order });

  const { data, error } = await listRecapShares();

  expect(error).toBeNull();
  expect(data).toEqual([
    { id: 's2', kind: 'year', createdAt: '2026-09-02T00:00:00Z', revokedAt: null },
    { id: 's1', kind: 'week', createdAt: '2026-09-01T00:00:00Z', revokedAt: '2026-09-01T01:00:00Z' },
  ]);
  expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
});

test('revokeRecapShare updates revoked_at for the given id', async () => {
  const eq = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn().mockReturnValue({ eq });
  (supabase.from as jest.Mock).mockReturnValue({ update });

  const { error } = await revokeRecapShare('s1');

  expect(error).toBeNull();
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
  expect(eq).toHaveBeenCalledWith('id', 's1');
});
