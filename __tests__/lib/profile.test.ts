import { fetchProfile, updateDisplayName, checkUsernameAvailable } from '../../lib/profile';
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
          data: { username: 'dhan', display_name: 'Dhan', avatar_url: null },
          error: null,
        }),
      }),
    });
    const result = await fetchProfile();
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(result).toEqual({
      data: { username: 'dhan', display_name: 'Dhan', avatar_url: null },
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

describe('checkUsernameAvailable', () => {
  test('lowercases the username and returns the RPC result', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const result = await checkUsernameAvailable('Dhan_99');
    expect(mockRpc).toHaveBeenCalledWith('is_username_available', { check_username: 'dhan_99' });
    expect(result).toEqual({ data: true, error: null });
  });

  test('returns an error instead of throwing when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const result = await checkUsernameAvailable('dhan');
    expect(result.data).toBeNull();
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
