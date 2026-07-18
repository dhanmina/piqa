-- Admin moderation — the human review that follows auto-quarantine. Admin-gated,
-- audited. Reviewing needs to see private submission images, so admins get a
-- storage read policy (RLS, not a service_role key) and sign URLs like the app does.

-- Let admins read any submission object so the queue can preview reported photos.
create policy "admins read all submission objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and public.is_admin());

-- The queue: every submission with at least one PENDING report, with its reason
-- breakdown, distinct-reporter count, quarantine state, and the auto threshold.
create or replace function public.admin_list_reports()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  threshold int := public.cfg_int('reports_quarantine_at', 3);
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  return coalesce((
    select jsonb_agg(
             row order by (row->>'quarantined')::boolean desc, (row->>'reporters')::int desc, row->>'latest' desc
           )
    from (
      select jsonb_build_object(
               'submission_id', s.id,
               'thumb_path', s.thumb_path,
               'shooter', pr.username,
               'shooter_id', s.user_id,
               'drop_date', pd.drop_date,
               'quarantined', coalesce(s.quarantined, false),
               'in_gallery', s.in_gallery,
               'reporters', (select count(distinct r2.user_id) from public.reports r2 where r2.submission_id = s.id),
               'reasons', (
                 select jsonb_object_agg(x.reason, x.c)
                 from (select reason, count(*) c from public.reports r3 where r3.submission_id = s.id group by reason) x
               ),
               'latest', (select max(r4.created_at) from public.reports r4 where r4.submission_id = s.id),
               'threshold', threshold
             ) as row
      from public.submissions s
      join public.profiles pr on pr.id = s.user_id
      join public.prompt_drops pd on pd.id = s.drop_id
      where exists (select 1 from public.reports r where r.submission_id = s.id and r.status = 'pending')
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_list_reports() from public, anon;
grant  execute on function public.admin_list_reports() to authenticated;

-- Resolve a submission's pending reports. remove = quarantine + mark actioned;
-- keep = release + mark dismissed. Either way the item leaves the queue.
create or replace function public.admin_resolve_report(p_submission uuid, p_remove boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  before jsonb;
begin
  if not public.is_admin(uid) then raise exception 'not_authorized'; end if;

  select jsonb_build_object('quarantined', coalesce(quarantined, false))
    into before
  from public.submissions where id = p_submission;
  if before is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_remove then
    update public.submissions set quarantined = true where id = p_submission;
    update public.reports set status = 'actioned' where submission_id = p_submission and status = 'pending';
  else
    update public.submissions set quarantined = false where id = p_submission;
    update public.reports set status = 'dismissed' where submission_id = p_submission and status = 'pending';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (uid,
          case when p_remove then 'moderation.remove' else 'moderation.keep' end,
          'submission', p_submission::text, before,
          jsonb_build_object('quarantined', p_remove, 'resolution', case when p_remove then 'actioned' else 'dismissed' end));

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_resolve_report(uuid, boolean) from public, anon;
grant  execute on function public.admin_resolve_report(uuid, boolean) to authenticated;
