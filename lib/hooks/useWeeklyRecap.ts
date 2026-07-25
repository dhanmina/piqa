import { useCallback } from 'react';

import { useCached } from '@lib/hooks/useCache';
import { useSession } from '@lib/session';
import { supabase } from '@lib/services/supabase';
import type { RecapData } from '@/components/molecules/WeeklyRecapCard';

/**
 * Fetches the weekly recap (last 7 days) for the signed-in user.
 * Uses the shared cache with a 5-minute TTL so rapid tab switches
 * don't re-fetch. Refresh manually via the returned `refresh` fn.
 */
export function useWeeklyRecap() {
  const { session } = useSession();
  const uid = session?.user.id ?? null;
  const key = uid ? `weekly_recap:${uid}` : 'weekly_recap:none';

  const { data, loading, error, refresh } = useCached<RecapData | null>(
    key,
    useCallback(async () => {
      if (!uid) return null;
      const { data, error } = await supabase.rpc('get_weekly_recap' as never, {
        p_user_id: uid,
      } as never);
      if (error) throw error;
      return (data as RecapData) ?? null;
    }, [uid]),
    300_000, // 5 min TTL
  );

  return { recap: data, loading, error, refresh };
}
