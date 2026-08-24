import { signInWithGoogle } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import * as WebBrowser from 'expo-web-browser';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: 'https://auth.example.com/authorize' }, error: null }),
      setSession: jest.fn().mockResolvedValue({ error: null }),
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
