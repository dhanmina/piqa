import { signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import * as WebBrowser from 'expo-web-browser';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: 'https://auth.example.com/authorize' }, error: null }),
      setSession: jest.fn().mockResolvedValue({ error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({
    type: 'success',
    url: 'piqa:///#access_token=tok123&refresh_token=ref456',
  }),
}));

jest.mock('expo-linking', () => ({ createURL: jest.fn().mockReturnValue('piqa:///') }));

test('signInWithGoogle opens the OAuth URL and completes the session from the redirect', async () => {
  const result = await signInWithGoogle();
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: 'piqa:///', skipBrowserRedirect: true },
  });
  expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
    'https://auth.example.com/authorize',
    'piqa:///'
  );
  expect(supabase.auth.setSession).toHaveBeenCalledWith({
    access_token: 'tok123',
    refresh_token: 'ref456',
  });
  expect(result.error).toBeNull();
});

test('signInWithGoogle returns an error instead of throwing when the native browser session rejects', async () => {
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockRejectedValueOnce(
    new Error("WebBrowser's auth session is in an invalid state with a redirect handler set when it should not be")
  );
  const result = await signInWithGoogle();
  expect(result.error).toBeInstanceOf(Error);
  expect(result.error?.message).toMatch(/invalid state/);
});

test('signInWithEmail calls signInWithPassword with the given credentials', async () => {
  const result = await signInWithEmail('user@example.com', 'hunter2');
  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'user@example.com',
    password: 'hunter2',
  });
  expect(result.error).toBeNull();
});

test('signUpWithEmail calls signUp with the given credentials and username', async () => {
  const result = await signUpWithEmail('user@example.com', 'hunter2', 'Dhan_99');
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: 'user@example.com',
    password: 'hunter2',
    options: { data: { username: 'dhan_99' } },
  });
  expect(result.error).toBeNull();
});

test('signOut calls supabase signOut', async () => {
  const result = await signOut();
  expect(supabase.auth.signOut).toHaveBeenCalled();
  expect(result.error).toBeNull();
});
