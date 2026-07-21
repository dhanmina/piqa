-- Nods (build plan Phase 1B · feature-research §3): a Curator's craft-recognition
-- tag on a photo. Positive-only, fixed set, one per curator per photo — the
-- emotional payoff of comments with none of the toxicity (no free text). Attaches
-- AFTER a pick (UI rule), never during the blind pair.

create table public.nods (
  curator_id    uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  tag           text not null check (tag in
                  ('great_light','strong_composition','bold_color','perfect_timing','moved_me')),
  created_at    timestamptz not null default now(),
  primary key (curator_id, submission_id)   -- one nod per curator per photo
);
create index nods_submission_idx on public.nods (submission_id);

alter table public.nods enable row level security;
-- Aggregates are public (like hearts); you may only write/remove your own.
create policy nods_read   on public.nods for select to authenticated using (true);
create policy nods_insert on public.nods for insert to authenticated with check (curator_id = auth.uid());
create policy nods_update on public.nods for update to authenticated using (curator_id = auth.uid());
create policy nods_delete on public.nods for delete to authenticated using (curator_id = auth.uid());

-- Add (or change) your nod on a photo. One per photo — re-submitting swaps the tag.
create or replace function public.submit_nod(p_submission uuid, p_tag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_tag not in ('great_light','strong_composition','bold_color','perfect_timing','moved_me') then
    raise exception 'invalid_tag';
  end if;
  -- No self-nod (mirrors no-self-vote): you can't tag your own photo.
  if exists (select 1 from public.submissions s where s.id = p_submission and s.user_id = uid) then
    raise exception 'no_self_nod';
  end if;
  insert into public.nods (curator_id, submission_id, tag)
  values (uid, p_submission, p_tag)
  on conflict (curator_id, submission_id) do update set tag = excluded.tag, created_at = now();
end;
$$;
revoke execute on function public.submit_nod(uuid, text) from public, anon;
grant  execute on function public.submit_nod(uuid, text) to authenticated;

-- Extend decorate_photos to include per-photo nod aggregates
-- ({ great_light: 3, strong_composition: 1 }). Additive — existing fields
-- unchanged, so gallery/profile keep working and the field is ignored until the
-- UI reads it.
create or replace function public.decorate_photos(p_photos jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           t.ph || jsonb_build_object(
             'frame_id',   public.photo_frame(pd.drop_date),
             'day_number', pd.day_number,
             'status',     public.photo_status(s.is_potd, s.gallery_rank),
             'nods',       coalesce((
                             select jsonb_object_agg(z.tag, z.cnt)
                             from (
                               select n.tag, count(*) as cnt
                               from public.nods n
                               where n.submission_id = s.id
                               group by n.tag
                             ) z
                           ), '{}'::jsonb)
           )
           order by t.ord
         ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) with ordinality as t(ph, ord)
  left join public.submissions   s  on s.id  = (t.ph ->> 'id')::uuid
  left join public.subject_drops pd on pd.id = s.drop_id;
$$;

revoke execute on function public.decorate_photos(jsonb) from public, anon;
grant  execute on function public.decorate_photos(jsonb) to authenticated, service_role;
