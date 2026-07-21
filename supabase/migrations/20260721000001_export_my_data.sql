-- Data export ("Download my data") — the read-only companion to delete_account
-- (Play/GDPR). Returns everything the authenticated user owns as one JSON blob.
-- Security definer but strictly scoped to auth.uid(), so it can never read another
-- user's rows.
--
-- NOTE: references votes.voter_id — Phase 0B renames it to curator_id, so this
-- function must be included in that migration's CREATE OR REPLACE sweep.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  return jsonb_build_object(
    'exported_at', now(),
    'user_id',     uid,
    'profile',     (select to_jsonb(p)  from public.profiles p  where p.id = uid),
    'streak',      (select to_jsonb(st) from public.streaks  st where st.user_id = uid),
    'submissions', coalesce((select jsonb_agg(to_jsonb(s) order by s.captured_at)
                             from public.submissions s where s.user_id = uid), '[]'::jsonb),
    'free_shots',  coalesce((select jsonb_agg(to_jsonb(f) order by f.captured_at)
                             from public.free_shots f where f.user_id = uid), '[]'::jsonb),
    'votes',       coalesce((select jsonb_agg(to_jsonb(v))
                             from public.votes v where v.voter_id = uid), '[]'::jsonb),
    'reactions',   coalesce((select jsonb_agg(to_jsonb(r))
                             from public.reactions r where r.user_id = uid), '[]'::jsonb),
    'follows',     coalesce((select jsonb_agg(to_jsonb(fo))
                             from public.follows fo where fo.follower_id = uid), '[]'::jsonb),
    'reports',     coalesce((select jsonb_agg(to_jsonb(rp))
                             from public.reports rp where rp.user_id = uid), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant  execute on function public.export_my_data() to authenticated;
