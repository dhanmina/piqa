import { renderHook, act } from '@testing-library/react-native';
import { useUsernameAvailability } from '../../lib/useUsernameAvailability';
import { checkUsernameAvailable } from '../../lib/profile';

jest.mock('../../lib/profile', () => ({ checkUsernameAvailable: jest.fn() }));
const mockCheck = checkUsernameAvailable as jest.Mock;

beforeEach(() => {
  mockCheck.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('is idle for an empty username', async () => {
  const { result } = await renderHook(() => useUsernameAvailability(''));
  expect(result.current).toEqual({ state: 'idle' });
  expect(mockCheck).not.toHaveBeenCalled();
});

test('is invalid immediately for a badly formatted username, without checking the network', async () => {
  const { result } = await renderHook(() => useUsernameAvailability('Bad Name!'));
  expect(result.current.state).toBe('invalid');
  await act(async () => jest.advanceTimersByTime(1000));
  expect(mockCheck).not.toHaveBeenCalled();
});

test('debounces the availability check for a well-formatted username', async () => {
  mockCheck.mockResolvedValue({ data: true, error: null });
  const { result, rerender } = await renderHook(({ u }: { u: string }) => useUsernameAvailability(u), { initialProps: { u: 'd' } });

  await rerender({ u: 'da' });
  await rerender({ u: 'dan' });
  expect(mockCheck).not.toHaveBeenCalled();

  await act(async () => jest.advanceTimersByTime(499));
  expect(mockCheck).not.toHaveBeenCalled();

  await act(async () => jest.advanceTimersByTime(1));
  expect(mockCheck).toHaveBeenCalledTimes(1);
  expect(mockCheck).toHaveBeenCalledWith('dan');

  await act(async () => {});
  expect(result.current.state).toBe('available');
});

test('reports taken when the RPC says the username is unavailable', async () => {
  mockCheck.mockResolvedValue({ data: false, error: null });
  const { result } = await renderHook(() => useUsernameAvailability('dan'));

  await act(async () => jest.advanceTimersByTime(500));
  await act(async () => {});
  expect(result.current.state).toBe('taken');
});

test('reports an error message when the RPC fails', async () => {
  mockCheck.mockResolvedValue({ data: null, error: new Error('network down') });
  const { result } = await renderHook(() => useUsernameAvailability('dan'));

  await act(async () => jest.advanceTimersByTime(500));
  await act(async () => {});
  expect(result.current.state).toBe('error');
  expect(result.current.state === 'error' && result.current.message).toBe('network down');
});

test('ignores a stale in-flight response when the username changes before it resolves', async () => {
  let resolveFirst: (v: { data: boolean; error: null }) => void = () => {};
  mockCheck.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
  mockCheck.mockResolvedValueOnce({ data: true, error: null });

  const { result, rerender } = await renderHook(({ u }: { u: string }) => useUsernameAvailability(u), { initialProps: { u: 'dan' } });
  await act(async () => jest.advanceTimersByTime(500));
  expect(result.current.state).toBe('checking');

  await rerender({ u: 'dave' });
  await act(async () => jest.advanceTimersByTime(500));
  expect(mockCheck).toHaveBeenCalledTimes(2);

  await act(async () => resolveFirst({ data: false, error: null }));

  // the stale ('dan') resolution should not flip the hook to 'taken' for 'dave'
  expect(result.current.state).not.toBe('taken');
});
