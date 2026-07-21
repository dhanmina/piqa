-- Admin content panel (in-app editorial · replaces daily hand-run SQL). One read
-- RPC that returns the current drop for a region plus the three fields the admin
-- edits every day — hint, is_golden, and (after reveal) the PotD note — so the
-- /admin screen can drive admin_set_subject_hint / admin_set_golden /
-- admin_set_potd_note without the admin ever touching SQL. Admin-gated.
create or replace function public.admin_today(p_region text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  reg  text;
  d    record;
  potd record;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;

  reg := coalesce(p_region, (select region from public.profiles where id = auth.uid()));

  select sd.id, sd.drop_date, sd.status, sd.drops_at, sd.submit_closes_at,
         sd.voting_closes_at, sd.prompt_id, sd.is_golden,
         s.text as subject_text, s.hint as subject_hint
    into d
  from public.subject_drops sd
  join public.subjects s on s.id = sd.prompt_id
  where sd.region = reg
  order by sd.drop_date desc
  limit 1;

  if d.id is null then
    return jsonb_build_object('region', reg, 'drop', null);
  end if;

  select su.id, su.potd_note, su.thumb_path, pr.username
    into potd
  from public.submissions su
  join public.profiles pr on pr.id = su.user_id
  where su.drop_id = d.id and su.is_potd = true
  limit 1;

  return jsonb_build_object(
    'region', reg,
    'drop', jsonb_build_object(
      'id', d.id,
      'drop_date', d.drop_date,
      'status', d.status,
      'drops_at', d.drops_at,
      'submit_closes_at', d.submit_closes_at,
      'voting_closes_at', d.voting_closes_at,
      'subject_id', d.prompt_id,
      'subject_text', d.subject_text,
      'hint', d.subject_hint,
      'is_golden', d.is_golden,
      'revealed', exists (select 1 from public.galleries g where g.drop_id = d.id),
      'potd', case when potd.id is null then null else jsonb_build_object(
        'submission_id', potd.id,
        'note', potd.potd_note,
        'thumb_path', potd.thumb_path,
        'shooter', potd.username
      ) end
    )
  );
end;
$$;
revoke execute on function public.admin_today(text) from public, anon;
grant  execute on function public.admin_today(text) to authenticated;
