-- Add image_path to admin_list_reports so the moderation UI can display
-- photos directly when storage thumbnails aren't available.
-- Also seeds test reports against a few submissions.

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
               'image_path', s.image_path,
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

-- Seed test data only — runs as a no-op in prod where seed users don't exist.
do $$ begin
  if exists (select 1 from public.profiles where id = md5('piqa-seed-user-1')::uuid) then

    update public.submissions
    set
      image_path = 'https://picsum.photos/seed/' || id::text || '/640/800',
      thumb_path = null
    where id in (
      md5('piqa-seed-submission-1')::uuid,
      md5('piqa-seed-submission-5')::uuid,
      md5('piqa-seed-submission-12')::uuid,
      md5('piqa-seed-submission-22')::uuid,
      md5('piqa-seed-submission-31')::uuid,
      md5('piqa-seed-submission-38')::uuid
    );

    insert into public.reports (user_id, submission_id, reason, status, created_at)
    select
      (array[md5('piqa-seed-user-2')::uuid, md5('piqa-seed-user-7')::uuid, md5('piqa-seed-user-15')::uuid])[(i % 3) + 1],
      s.id,
      (array['nudity', 'not_real_photo', 'violence', 'harassment', 'other'])[(i % 5) + 1],
      'pending',
      now() - ((i * 17) || ' minutes')::interval
    from (select md5('piqa-seed-submission-1')::uuid as id, generate_series(0, 2) as i) s
    union all
    select
      (array[md5('piqa-seed-user-3')::uuid, md5('piqa-seed-user-8')::uuid, md5('piqa-seed-user-20')::uuid, md5('piqa-seed-user-25')::uuid])[(i % 4) + 1],
      s.id,
      (array['nudity', 'nudity', 'not_real_photo'])[(i % 3) + 1],
      'pending',
      now() - ((i * 12) || ' minutes')::interval
    from (select md5('piqa-seed-submission-5')::uuid as id, generate_series(0, 3) as i) s
    union all
    select
      (array[md5('piqa-seed-user-5')::uuid, md5('piqa-seed-user-10')::uuid])[(i % 2) + 1],
      s.id,
      (array['violence', 'violence'])[(i % 2) + 1],
      'pending',
      now() - ((i * 23) || ' minutes')::interval
    from (select md5('piqa-seed-submission-12')::uuid as id, generate_series(0, 1) as i) s
    union all
    select
      md5('piqa-seed-user-11')::uuid,
      s.id,
      'other',
      'pending',
      now() - '5 minutes'::interval
    from (select md5('piqa-seed-submission-22')::uuid as id) s
    union all
    select
      (array[md5('piqa-seed-user-1')::uuid, md5('piqa-seed-user-6')::uuid, md5('piqa-seed-user-14')::uuid, md5('piqa-seed-user-18')::uuid, md5('piqa-seed-user-22')::uuid])[(i % 5) + 1],
      s.id,
      (array['nudity', 'harassment', 'nudity', 'other', 'not_real_photo'])[(i % 5) + 1],
      'pending',
      now() - ((i * 8) || ' minutes')::interval
    from (select md5('piqa-seed-submission-31')::uuid as id, generate_series(0, 4) as i) s
    union all
    select
      md5('piqa-seed-user-9')::uuid,
      s.id,
      'harassment',
      'pending',
      now() - '2 minutes'::interval
    from (select md5('piqa-seed-submission-38')::uuid as id) s
    on conflict do nothing;

  end if;
end $$;
