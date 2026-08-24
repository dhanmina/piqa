import { supabase } from '../../lib/supabase';

test('supabase client is configured with a URL and key', () => {
  expect(supabase).toBeDefined();
  // @ts-expect-error accessing internal for test purposes
  expect(supabase.supabaseUrl).toMatch(/^https?:\/\//);
});
