import { saveIntentTheme, markOnboardingComplete, getOnboardingStatus } from '../../lib/onboarding';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: jest.fn(() => ({
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { onboarded_at: null } }) }) }),
    })),
  },
}));

function lastFromResult() {
  const mockFrom = supabase.from as jest.Mock;
  return mockFrom.mock.results[mockFrom.mock.results.length - 1].value;
}

test('saveIntentTheme updates the profiles row for the current user', async () => {
  await saveIntentTheme('practice photography');
  expect(supabase.from).toHaveBeenCalledWith('profiles');
});

test('markOnboardingComplete sets onboarded_at on the profiles row', async () => {
  await markOnboardingComplete();
  const result = lastFromResult();
  expect(result.update).toHaveBeenCalledWith(expect.objectContaining({ onboarded_at: expect.any(String) }));
});

test('getOnboardingStatus returns false when onboarded_at is null', async () => {
  const result = await getOnboardingStatus();
  expect(result).toBe(false);
});
