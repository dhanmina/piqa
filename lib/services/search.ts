import { supabase } from './supabase';

export type SearchUser = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_following: boolean;
  followers: number;
  hearts: number;
};

export async function searchUsers(query: string): Promise<SearchUser[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  
  const { data, error } = await (supabase.rpc as any)('search_users', { p_query: term });
    
  if (error) {
    console.warn('Search error:', error);
    return [];
  }
  
  return (data as SearchUser[]) ?? [];
}
