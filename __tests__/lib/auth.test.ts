import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  requestPasswordReset,
  completePasswordReset,
  verifyPasswordResetCode,
} from '../../lib/auth';
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
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ error: null }),
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

test('requestPasswordReset calls resetPasswordForEmail with a piqa:// redirect', async () => {
  const result = await requestPasswordReset('user@example.com');
  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
    redirectTo: 'piqa:///',
  });
  expect(result.error).toBeNull();
});

test('completePasswordReset extracts tokens from the recovery link and sets the session', async () => {
  const result = await completePasswordReset('piqa://reset-password#access_token=tok123&refresh_token=ref456&type=recovery');
  expect(supabase.auth.setSession).toHaveBeenCalledWith({
    access_token: 'tok123',
    refresh_token: 'ref456',
  });
  expect(result.error).toBeNull();
});

test('completePasswordReset surfaces the link error instead of calling setSession', async () => {
  (supabase.auth.setSession as jest.Mock).mockClear();
  const result = await completePasswordReset(
    'piqa://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
  );
  expect(result.error).toBeInstanceOf(Error);
  expect(result.error?.message).toBe('Email link is invalid or has expired');
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
});

test('completePasswordReset rejects a link with no tokens', async () => {
  (supabase.auth.setSession as jest.Mock).mockClear();
  const result = await completePasswordReset('piqa://reset-password');
  expect(result.error).toBeInstanceOf(Error);
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
});

test('verifyPasswordResetCode calls verifyOtp with the emailed code', async () => {
  const result = await verifyPasswordResetCode('user@example.com', '123456');
  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
    email: 'user@example.com',
    token: '123456',
    type: 'recovery',
  });
  expect(result.error).toBeNull();
});
