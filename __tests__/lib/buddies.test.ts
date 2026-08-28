import {
  searchProfiles,
  sendBuddyRequest,
  respondToBuddyRequest,
  reactToCapture,
  fetchPendingRequests,
  fetchBuddies,
} from '../../lib/buddies';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

const mockRpc = supabase.rpc as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;

beforeEach(() => {
  mockRpc.mockReset();
  mockStorageFrom.mockReset();
});

describe('searchProfiles', () => {
  test('maps rows to camelCase', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'u1', username: 'bob', display_name: 'Bob', avatar_url: null, relationship: 'none' }],
      error: null,
    });
    const result = await searchProfiles('bob');
    expect(mockRpc).toHaveBeenCalledWith('search_profiles', { query: 'bob' });
    expect(result).toEqual({
      data: [{ id: 'u1', username: 'bob', displayName: 'Bob', avatarUrl: null, relationship: 'none' }],
      error: null,
    });
  });

  test('returns an error instead of throwing when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const result = await searchProfiles('bob');
    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('sendBuddyRequest', () => {
  test('calls send_buddy_request with the username', async () => {
    mockRpc.mockResolvedValue({ data: 'req-1', error: null });
    const result = await sendBuddyRequest('bob');
    expect(mockRpc).toHaveBeenCalledWith('send_buddy_request', { recipient_username: 'bob' });
    expect(result.error).toBeNull();
  });

  test('surfaces the RPC error message', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'You already have 3 buddies' } });
    const result = await sendBuddyRequest('bob');
    expect(result.error?.message).toBe('You already have 3 buddies');
  });
});

describe('respondToBuddyRequest', () => {
  test('calls respond_buddy_request with request_id and accept', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const result = await respondToBuddyRequest('req-1', true);
    expect(mockRpc).toHaveBeenCalledWith('respond_buddy_request', { request_id: 'req-1', accept: true });
    expect(result.error).toBeNull();
  });
});

describe('reactToCapture', () => {
  test('calls react_to_capture with target_capture_id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const result = await reactToCapture('cap-1');
    expect(mockRpc).toHaveBeenCalledWith('react_to_capture', { target_capture_id: 'cap-1' });
    expect(result.error).toBeNull();
  });
});

describe('fetchPendingRequests', () => {
  test('maps rows to camelCase', async () => {
    mockRpc.mockResolvedValue({
      data: [{ request_id: 'req-1', requester_id: 'u1', username: 'bob', display_name: 'Bob', avatar_url: null }],
      error: null,
    });
    const result = await fetchPendingRequests();
    expect(result.data).toEqual([
      { requestId: 'req-1', requesterId: 'u1', username: 'bob', displayName: 'Bob', avatarUrl: null },
    ]);
  });
});

describe('fetchBuddies', () => {
  test('resolves signed urls for buddies with a today capture', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          buddy_id: 'u1', username: 'bob', display_name: 'Bob', avatar_url: null,
          current_count: 5, status: 'captured_today', today_capture_id: 'cap-1',
          today_storage_path: 'bob/today.jpg', reacted_by_me: false,
        },
        {
          buddy_id: 'u2', username: 'erin', display_name: 'Erin', avatar_url: null,
          current_count: 0, status: 'none', today_capture_id: null,
          today_storage_path: null, reacted_by_me: false,
        },
      ],
      error: null,
    });
    mockStorageFrom.mockReturnValue({
      createSignedUrls: jest.fn().mockResolvedValue({
        data: [{ path: 'bob/today.jpg', signedUrl: 'https://signed/bob-today.jpg' }],
        error: null,
      }),
    });

    const result = await fetchBuddies();

    expect(mockStorageFrom).toHaveBeenCalledWith('captures');
    expect(result.data).toEqual([
      {
        id: 'u1', username: 'bob', displayName: 'Bob', avatarUrl: null, currentCount: 5,
        status: 'captured_today', todayCaptureId: 'cap-1', todayPhotoUrl: 'https://signed/bob-today.jpg',
        reactedByMe: false,
      },
      {
        id: 'u2', username: 'erin', displayName: 'Erin', avatarUrl: null, currentCount: 0,
        status: 'none', todayCaptureId: null, todayPhotoUrl: null, reactedByMe: false,
      },
    ]);
  });

  test('skips the signed-url call when no buddy has a today capture', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        buddy_id: 'u2', username: 'erin', display_name: 'Erin', avatar_url: null,
        current_count: 0, status: 'none', today_capture_id: null, today_storage_path: null, reacted_by_me: false,
      }],
      error: null,
    });
    const result = await fetchBuddies();
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(result.data[0].todayPhotoUrl).toBeNull();
  });

  test('returns an error instead of throwing when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const result = await fetchBuddies();
    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });
});
