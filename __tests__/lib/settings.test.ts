import { fetchAccountInfo, changePassword, deleteOwnAccount } from '../../lib/settings';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(), updateUser: jest.fn() },
    rpc: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;

beforeEach(() => {
  mockGetUser.mockReset();
  mockUpdateUser.mockReset();
  mockRpc.mockReset();
  mockStorageFrom.mockReset();
});

describe('fetchAccountInfo', () => {
  test('marks an email/password user as able to change password', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'dhan@example.com', app_metadata: { provider: 'email' } } },
      error: null,
    });
    const result = await fetchAccountInfo();
    expect(result).toEqual({
      data: { email: 'dhan@example.com', canChangePassword: true },
      error: null,
    });
  });

  test('marks a Google user as unable to change password', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'dhan@example.com', app_metadata: { provider: 'google' } } },
      error: null,
    });
    const result = await fetchAccountInfo();
    expect(result.data).toEqual({ email: 'dhan@example.com', canChangePassword: false });
  });

  test('returns an error instead of throwing when getUser fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'network down' } });
    const result = await fetchAccountInfo();
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });

  test('returns an error instead of throwing when there is no signed-in user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await fetchAccountInfo();
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('changePassword', () => {
  test('updates the password and returns no error', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const result = await changePassword('new-hunter2');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-hunter2' });
    expect(result.error).toBeNull();
  });

  test('returns the raw Supabase error (with its code) instead of throwing', async () => {
    mockUpdateUser.mockResolvedValue({ error: { code: 'weak_password', message: 'Password too weak' } });
    const result = await changePassword('123');
    expect(result.error).toEqual({ code: 'weak_password', message: 'Password too weak' });
  });
});

describe('deleteOwnAccount', () => {
  function mockBucket() {
    const remove = jest.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockImplementation(() => ({ remove }));
    return remove;
  }

  test('removes each capture (and its thumbnail) plus the avatar after the RPC succeeds', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRpc.mockResolvedValue({ data: ['user-1/a.jpg', 'user-1/b.jpg'], error: null });
    const remove = mockBucket();

    const result = await deleteOwnAccount();

    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
    expect(mockStorageFrom).toHaveBeenCalledWith('captures');
    expect(remove).toHaveBeenCalledWith(['user-1/a.jpg', 'user-1/a-thumb.jpg', 'user-1/b.jpg', 'user-1/b-thumb.jpg']);
    expect(mockStorageFrom).toHaveBeenCalledWith('avatars');
    expect(remove).toHaveBeenCalledWith(['user-1/avatar.jpg']);
  });

  test('returns an error instead of throwing when not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await deleteOwnAccount();

    expect(result.error).toBeInstanceOf(Error);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('returns the RPC error without touching storage', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockRpc.mockResolvedValue({ data: null, error: new Error('db down') });
    const remove = mockBucket();

    const result = await deleteOwnAccount();

    expect(result.error).toEqual(new Error('db down'));
    expect(remove).not.toHaveBeenCalled();
  });
});
