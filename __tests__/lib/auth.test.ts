import { signInWithGoogle } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: jest.fn().mockResolvedValue({ error: null }) } },
}));

test('signInWithGoogle calls Supabase OAuth with google provider', async () => {
  const result = await signInWithGoogle();
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google' });
  expect(result.error).toBeNull();
});
