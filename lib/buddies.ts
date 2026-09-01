import { supabase } from './supabase';

export type BuddyRelationship = 'none' | 'pending_sent' | 'pending_received' | 'accepted';
export type BuddyStatus = 'captured_today' | 'frozen_today' | 'at_risk' | 'none';

export type SearchResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  relationship: BuddyRelationship;
  requestId: string | null;
};

export type Buddy = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  currentCount: number;
  status: BuddyStatus;
  todayCaptureId: string | null;
  todayPhotoUrl: string | null;
  reactedByMe: boolean;
};

export type PendingRequest = {
  requestId: string;
  requesterId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function searchProfiles(query: string): Promise<{ data: SearchResult[]; error: Error | null }> {
  const { data, error } = await supabase.rpc('search_profiles', { query });
  if (error) return { data: [], error: new Error(error.message) };
  const rows: {
    id: string; username: string; display_name: string | null; avatar_url: string | null;
    relationship: BuddyRelationship; request_id: string | null;
  }[] = data ?? [];
  return {
    data: rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      relationship: r.relationship,
      requestId: r.request_id,
    })),
    error: null,
  };
}

export async function sendBuddyRequest(username: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('send_buddy_request', { recipient_username: username });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function respondToBuddyRequest(requestId: string, accept: boolean): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('respond_buddy_request', { request_id: requestId, accept });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function cancelBuddyRequest(requestId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('cancel_buddy_request', { request_id: requestId });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function removeBuddy(buddyId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('remove_buddy', { buddy_id: buddyId });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function reactToCapture(captureId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('react_to_capture', { target_capture_id: captureId });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function fetchPendingRequests(): Promise<{ data: PendingRequest[]; error: Error | null }> {
  const { data, error } = await supabase.rpc('get_pending_requests');
  if (error) return { data: [], error: new Error(error.message) };
  const rows: { request_id: string; requester_id: string; username: string; display_name: string | null; avatar_url: string | null }[] = data ?? [];
  return {
    data: rows.map((r) => ({ requestId: r.request_id, requesterId: r.requester_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url })),
    error: null,
  };
}

export type BuddyPeek = {
  buddyId: string;
  buddyUsername: string;
  buddyDisplayName: string | null;
  buddyAvatarUrl: string | null;
  myCaptureId: string;
  myPhotoUrl: string;
  buddyCaptureId: string;
  buddyPhotoUrl: string;
  label: string;
  reactedByMe: boolean;
};

// today: the caller's local date (YYYY-MM-DD), same reason get_today_state/
// get_peek_back take one -- current_date server-side is UTC and disagrees with
// captures.captured_at near local midnight.
export async function fetchBuddyPeek(today: string): Promise<{ data: BuddyPeek | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('get_buddy_peek', { p_today: today });
  if (error) return { data: null, error: new Error(error.message) };

  const row: {
    buddy_id: string; buddy_username: string; buddy_display_name: string | null; buddy_avatar_url: string | null;
    my_capture_id: string; my_storage_path: string; buddy_capture_id: string; buddy_storage_path: string;
    captured_at: string; label: string; reacted_by_me: boolean;
  } | undefined = data?.[0];
  if (!row) return { data: null, error: null };

  // Deduped -- both roles can legitimately point at the same storage_path (e.g. a
  // reused-photo test seed), and a duplicate path in one createSignedUrls call isn't
  // guaranteed to come back as two result entries.
  const paths = Array.from(new Set([row.my_storage_path, row.buddy_storage_path]));
  const { data: signed, error: signError } = await supabase.storage.from('captures').createSignedUrls(paths, 3600);
  if (signError) return { data: null, error: new Error(signError.message) };

  const urlByPath = new Map<string, string>();
  signed?.forEach((s) => {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  });
  const myPhotoUrl = urlByPath.get(row.my_storage_path);
  const buddyPhotoUrl = urlByPath.get(row.buddy_storage_path);
  // A failed sign on either side (e.g. a storage policy edge case) means the
  // moment can't be shown as a matched pair -- fail soft to "no peek today"
  // rather than render half a match, but log it -- this used to be silent,
  // indistinguishable from "no match today" from the caller's side.
  if (!myPhotoUrl || !buddyPhotoUrl) {
    console.warn('[fetchBuddyPeek] signed url missing for one or both paths', paths, signed);
    return { data: null, error: null };
  }

  return {
    data: {
      buddyId: row.buddy_id,
      buddyUsername: row.buddy_username,
      buddyDisplayName: row.buddy_display_name,
      buddyAvatarUrl: row.buddy_avatar_url,
      myCaptureId: row.my_capture_id,
      myPhotoUrl,
      buddyCaptureId: row.buddy_capture_id,
      buddyPhotoUrl,
      label: row.label,
      reactedByMe: row.reacted_by_me,
    },
    error: null,
  };
}

export async function fetchBuddies(): Promise<{ data: Buddy[]; error: Error | null }> {
  const { data, error } = await supabase.rpc('get_buddies');
  if (error) return { data: [], error: new Error(error.message) };

  const rows: {
    buddy_id: string; username: string; display_name: string | null; avatar_url: string | null;
    current_count: number; status: BuddyStatus; today_capture_id: string | null;
    today_storage_path: string | null; reacted_by_me: boolean;
  }[] = data ?? [];

  const pathsToSign = rows.filter((r) => r.today_storage_path).map((r) => r.today_storage_path!);
  const urlByPath = new Map<string, string>();
  if (pathsToSign.length > 0) {
    const { data: signed, error: signError } = await supabase.storage.from('captures').createSignedUrls(pathsToSign, 3600);
    if (signError) return { data: [], error: new Error(signError.message) };
    signed?.forEach((s) => {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
    });
    pathsToSign.forEach((p) => {
      if (!urlByPath.has(p)) {
        console.warn(`fetchBuddies: no signed url resolved for path "${p}"`);
      }
    });
  }

  return {
    data: rows.map((r) => ({
      id: r.buddy_id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      currentCount: r.current_count,
      status: r.status,
      todayCaptureId: r.today_capture_id,
      todayPhotoUrl: r.today_storage_path ? (urlByPath.get(r.today_storage_path) ?? null) : null,
      reactedByMe: r.reacted_by_me,
    })),
    error: null,
  };
}
