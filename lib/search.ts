import { supabase } from './supabase';

export type SearchUser = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export async function searchUsers(query: string): Promise<SearchUser[]> {
  if (!query || query.trim().length < 2) return [];
  
  const safeQuery = query.trim().replace(/[%_]/g, ''); // sanitize basic like wildcards
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${safeQuery}%`)
    .limit(20);
    
  if (error) {
    console.warn('Search error:', error);
    return [];
  }
  
  return data ?? [];
}
