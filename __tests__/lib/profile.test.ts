import { fetchProfile, fetchStats, fetchArchiveMosaic, updateDisplayName } from '../../lib/profile';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockStorageFrom.mockReset();
  mockGetUser.mockReset();
});

describe('fetchProfile', () => {
  test('returns profile data on success', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { display_name: 'Dhan', avatar_url: null, created_at: '2026-01-01' },
          error: null,
        }),
      }),
    });
    const result = await fetchProfile();
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(result).toEqual({
      data: { display_name: 'Dhan', avatar_url: null, created_at: '2026-01-01' },
      error: null,
    });
  });

  test('returns an error instead of throwing when the query fails', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'network down' } }),
      }),
    });
    const result = await fetchProfile();
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('network down');
  });
});

describe('fetchStats', () => {
  test('returns the first row from get_today_state', async () => {
    mockRpc.mockResolvedValue({ data: [{ current_count: 5, longest_count: 12 }], error: null });
    const result = await fetchStats();
    expect(mockRpc).toHaveBeenCalledWith('get_today_state');
    expect(result).toEqual({ data: { current_count: 5, longest_count: 12 }, error: null });
  });

  test('returns an error instead of throwing when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const result = await fetchStats();
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('fetchArchiveMosaic', () => {
  test('returns signed-url photos for each returned row', async () => {
    mockRpc.mockResolvedValue({
      data: [{ storage_path: 'a.jpg', captured_at: '2026-01-01' }],
      error: null,
    });
    mockStorageFrom.mockReturnValue({
      createSignedUrls: jest.fn().mockResolvedValue({
        data: [{ path: 'a.jpg', signedUrl: 'https://signed/a.jpg' }],
        error: null,
      }),
    });
    const result = await fetchArchiveMosaic();
    expect(result).toEqual({
      data: [{ url: 'https://signed/a.jpg', capturedAt: '2026-01-01' }],
      error: null,
    });
  });

  test('returns an empty array without calling storage when there are no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const result = await fetchArchiveMosaic();
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(result).toEqual({ data: [], error: null });
  });

  test('returns an error instead of throwing when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const result = await fetchArchiveMosaic();
    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('updateDisplayName', () => {
  test('updates the trimmed display name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const single = jest.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await updateDisplayName('  Dhan  ');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ display_name: 'Dhan' });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(select).toHaveBeenCalledWith('id');
    expect(result.error).toBeNull();
  });

  test('returns an error instead of throwing when the update fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: 'network down' } });
    const select = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await updateDisplayName('Dhan');

    expect(result.error).toBeInstanceOf(Error);
  });

  test('returns an error instead of a silent success when there is no signed-in user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await updateDisplayName('Dhan');

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
