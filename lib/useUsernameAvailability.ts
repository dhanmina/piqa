import { useEffect, useRef, useState } from 'react';
import { checkUsernameAvailable } from './profile';

const USERNAME_CHARSET = /^[a-z0-9_]+$/;
const DEBOUNCE_MS = 500;

export const USERNAME_HINT = 'Lowercase letters, numbers, or _';

function classifyUsernameFormat(username: string): string | null {
  if (username.length < 3) return 'At least 3 characters';
  if (username.length > 20) return 'Max 20 characters';
  if (!USERNAME_CHARSET.test(username)) return 'Lowercase, numbers, or _ only';
  return null;
}

export type UsernameAvailability =
  | { state: 'idle' }
  | { state: 'invalid'; message: string }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken' }
  | { state: 'error'; message: string };

export function useUsernameAvailability(rawUsername: string): UsernameAvailability {
  const [status, setStatus] = useState<UsernameAvailability>({ state: 'idle' });
  const requestId = useRef(0);

  useEffect(() => {
    const username = rawUsername.trim().toLowerCase();
    requestId.current += 1;
    const thisRequest = requestId.current;

    if (!username) {
      setStatus({ state: 'idle' });
      return;
    }
    const formatError = classifyUsernameFormat(username);
    if (formatError) {
      setStatus({ state: 'invalid', message: formatError });
      return;
    }

    setStatus({ state: 'checking' });
    const timer = setTimeout(async () => {
      const { data, error } = await checkUsernameAvailable(username);
      if (requestId.current !== thisRequest) return;
      if (error) {
        setStatus({ state: 'error', message: error.message });
      } else {
        setStatus({ state: data ? 'available' : 'taken' });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [rawUsername]);

  return status;
}
