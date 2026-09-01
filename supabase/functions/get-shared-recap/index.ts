// supabase/functions/get-shared-recap/index.ts
//
// The only public, unauthenticated entry point into a user's captures. A share id
// is an unguessable uuid (recap_shares.id), so knowing it is the whole access
// control -- there is no further per-request secret. This function uses the
// service-role key specifically to bypass the storage/table RLS that otherwise
// requires auth.uid() (see 0002_captures.sql's captures_storage_select_own policy),
// since a public viewer has no Supabase session at all.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SIGNED_URL_TTL_SECONDS = 3600;

// Mirrors lib/photoPaths.ts's toThumbPath -- kept in sync by hand, same as the
// recovery.html email template keeps lib/theme.ts's tokens in sync by hand,
// because this function can't import from the RN app's lib/ directory.
function toThumbPath(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? `${path}-thumb` : `${path.slice(0, dot)}-thumb${path.slice(dot)}`;
}

function formatRange(start: string, end: string): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return start === end ? fmt(start) : `${fmt(start)} - ${fmt(end)}`;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const shareId = new URL(req.url).searchParams.get('id');
  if (!shareId) return json({ error: 'Missing id' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: share, error: shareError } = await admin
    .from('recap_shares')
    .select('user_id, kind, range_start, range_end, revoked_at')
    .eq('id', shareId)
    .single();

  if (shareError || !share || share.revoked_at) {
    return json({ error: 'This link is no longer available.' }, 404);
  }

  const { data: rows, error: capturesError } = await admin
    .from('captures')
    .select('storage_path, captured_at')
    .eq('user_id', share.user_id)
    .gte('captured_at', share.range_start)
    .lte('captured_at', share.range_end)
    .order('captured_at', { ascending: true });

  if (capturesError) return json({ error: 'Could not load this recap.' }, 500);

  const thumbPaths = (rows ?? []).map((r) => toThumbPath(r.storage_path));
  const { data: signed } = await admin.storage.from('captures').createSignedUrls(thumbPaths, SIGNED_URL_TTL_SECONDS);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const photos = (rows ?? []).flatMap((r, i) => {
    const url = urlByPath.get(thumbPaths[i]);
    return url ? [{ url, capturedAt: r.captured_at }] : [];
  });

  return json({
    kind: share.kind,
    rangeLabel: formatRange(share.range_start, share.range_end),
    photos,
  });
});
