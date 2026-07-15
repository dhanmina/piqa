-- Frame system — the photo as a print (spec: frame renderer).
--
-- A frame is an OVERLAY, never composited into a stored file. It carries four
-- things, three of which did not exist in this schema before today:
--
--   * day_number  — the global day counter. Everything here was keyed on
--                   drop_date; nothing counted days. Now: days since launch, so
--                   the number tracks the calendar even if a day is ever skipped.
--                   It gets printed on shared images permanently — it must not
--                   drift.
--   * status      — 'crown' (PotD) | 'top10' | null. is_potd was a boolean and
--                   there was no rank at all, so top10 was unrepresentable.
--                   close_day ALREADY computes the rank and throws it away; we
--                   just persist it now.
--   * equipped_frame — the owner's chosen frame. Read LIVE, never frozen into a
--                   gallery payload, so changing it re-renders every surface at
--                   once (that is the whole point of an overlay).
--
-- It also closes a live hole. `authenticated` held a table-wide UPDATE grant on
-- submissions plus a "users update own submission" policy, so a client could run
--     update submissions set is_potd = true where user_id = me
-- and crown itself. Status is supposed to be server-only. Nothing in the app has
-- ever used that grant (starring goes through the toggle_star SECURITY DEFINER
-- RPC; the client only ever inserts), so it is revoked outright below.

-- ---------------------------------------------------------------------------
-- 1. day_number — the global day counter
-- ---------------------------------------------------------------------------

-- Launch day = the first drop we ever ran (or today, on a virgin database).
insert into public.config (key, value)
select 'launch_date', to_jsonb(coalesce(min(drop_date), current_date)::text)
from public.prompt_drops
on conflict (key) do nothing;

alter table public.prompt_drops add column if not exists day_number integer;

update public.prompt_drops pd
  set day_number = (pd.drop_date - (select (value #>> '{}')::date
                                    from public.config where key = 'launch_date')) + 1
  where pd.day_number is null;

alter table public.prompt_drops alter column day_number set not null;

-- Server-computed on every insert, so no client or edge function can pass one in.
create or replace function public.set_day_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  launch date;
begin
  select (value #>> '{}')::date into launch from public.config where key = 'launch_date';
  if launch is null then
    launch := new.drop_date;
    insert into public.config (key, value) values ('launch_date', to_jsonb(launch::text))
      on conflict (key) do nothing;
  end if;
  new.day_number := (new.drop_date - launch) + 1;
  return new;
end;
$$;

drop trigger if exists prompt_drops_day_number on public.prompt_drops;
create trigger prompt_drops_day_number
  before insert on public.prompt_drops
  for each row execute function public.set_day_number();

-- ---------------------------------------------------------------------------
-- 2. gallery_rank — makes 'top10' representable
-- ---------------------------------------------------------------------------

alter table public.submissions add column if not exists gallery_rank integer;

-- Backfill, but ONLY for drops that actually closed. A rank is a verdict, and an
-- open day has not been judged: status derives top10 from `gallery_rank <= 10`, so
-- ranking a live (or seed-fallback) drop here would hand out Top 10 rings that
-- close_day never awarded. Unclosed drops keep gallery_rank null → status null.
-- close_day ranks by (score desc, ncomp desc, id); ncomp is not stored, so
-- vote_count stands in for it on historical rows.
with ranked as (
  select s.id,
         row_number() over (
           partition by s.drop_id
           order by s.bt_score desc nulls last, s.vote_count desc, s.id
         ) as rnk
  from public.submissions s
  where s.thumb_path is not null
    and exists (select 1 from public.galleries g where g.drop_id = s.drop_id)
)
update public.submissions sub
  set gallery_rank = r.rnk
  from ranked r
  where sub.id = r.id and sub.gallery_rank is null;

-- One definition of status, used by every read path. gallery_min is 10, so a
-- top10 photo is always also in the gallery.
create or replace function public.photo_status(p_is_potd boolean, p_rank integer)
returns text
language sql
immutable
as $$
  select case
           when p_is_potd then 'crown'
           when p_rank is not null and p_rank <= 10 then 'top10'
           else null
         end;
$$;

-- ---------------------------------------------------------------------------
-- 3. frames + user_frames + profiles.equipped_frame
-- ---------------------------------------------------------------------------

create table if not exists public.frames (
  id    text primary key,
  label text not null
);

insert into public.frames (id, label) values
  ('default', 'Default'),
  ('crown',   'Crown')
on conflict (id) do nothing;

-- Unlocks are written by close_day ONLY. authenticated gets select and nothing
-- else — there is deliberately no insert grant and no insert policy.
create table if not exists public.user_frames (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  frame_id    text not null references public.frames (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, frame_id)
);

-- Anyone who has already won a crown owns the frame.
insert into public.user_frames (user_id, frame_id)
select distinct user_id, 'crown' from public.submissions where is_potd
on conflict do nothing;

alter table public.profiles
  add column if not exists equipped_frame text not null default 'default'
  references public.frames (id);

-- RLS cannot express "only a frame you own", so the guard is a trigger. It fires
-- only when equipped_frame actually changes, so close_day's xp writes pass clean.
create or replace function public.enforce_equipped_frame()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.equipped_frame is distinct from old.equipped_frame
     and new.equipped_frame <> 'default'
     and not exists (
       select 1 from public.user_frames uf
       where uf.user_id = new.id and uf.frame_id = new.equipped_frame
     )
  then
    raise exception 'frame_not_unlocked';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_equipped_frame_guard on public.profiles;
create trigger profiles_equipped_frame_guard
  before update on public.profiles
  for each row execute function public.enforce_equipped_frame();

alter table public.frames      enable row level security;
alter table public.user_frames enable row level security;

drop policy if exists "frames are readable" on public.frames;
create policy "frames are readable"
  on public.frames for select to authenticated using (true);

drop policy if exists "own frame unlocks readable" on public.user_frames;
create policy "own frame unlocks readable"
  on public.user_frames for select to authenticated using (user_id = auth.uid());

grant select on public.frames      to authenticated;
grant select on public.user_frames to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lock down what the client may write
-- ---------------------------------------------------------------------------

-- Unused since day one, and it let a user set their own is_potd / in_gallery /
-- bt_score / gallery_rank. Status is server-only; make that true.
drop policy if exists "users update own submission" on public.submissions;
revoke update on public.submissions from authenticated;

-- profiles had a table-wide UPDATE grant, which also let a user set their own
-- xp. Narrow it to the columns the app actually writes; equipped_frame joins
-- them (and is additionally guarded by the trigger above).
revoke update on public.profiles from authenticated;
grant update (username, avatar_url, timezone, push_token, equipped_frame)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 5. decorate_photos — adds frame/status/day to any photo array
-- ---------------------------------------------------------------------------
--
-- Companion to filter_public_photos, and composes with it. Gallery payloads are
-- FROZEN at close, so equipped_frame must be joined here, at read time, from the
-- live profile — baking it into the payload would freeze a user's frame forever.
-- status and day_number are immutable after close but are read live too, so old
-- payloads (written before this migration) pick them up for free.
create or replace function public.decorate_photos(p_photos jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           t.ph || jsonb_build_object(
             'equipped_frame', coalesce(pr.equipped_frame, 'default'),
             'day_number',     pd.day_number,
             'status',         public.photo_status(s.is_potd, s.gallery_rank)
           )
           order by t.ord
         ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) with ordinality as t(ph, ord)
  left join public.submissions   s  on s.id  = (t.ph ->> 'id')::uuid
  left join public.profiles      pr on pr.id = s.user_id
  left join public.prompt_drops  pd on pd.id = s.drop_id;
$$;

revoke execute on function public.decorate_photos(jsonb) from public, anon;
grant  execute on function public.decorate_photos(jsonb) to authenticated, service_role;

revoke execute on function public.photo_status(boolean, integer) from public, anon;
grant  execute on function public.photo_status(boolean, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. close_day — persist gallery_rank; grant the crown frame to the winner
-- ---------------------------------------------------------------------------
-- Identical to 20260712000004_today_reveal.sql except for the two marked blocks.
create or replace function public.close_day(p_drop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[];
  k int;
  wins double precision[];
  ncomp int[];
  nmat double precision[];
  s double precision[];
  news double precision[];
  bt double precision[];
  score double precision[];
  numer double precision;
  denom double precision;
  ln_sum double precision;
  gm double precision;
  mu double precision;
  cval double precision := public.cfg_num('bt_shrink_c', 5);
  gpct int := public.cfg_int('gallery_pct', 20);
  gmin int := public.cfg_int('gallery_min', 10);
  gmax int := public.cfg_int('gallery_max', 50);
  quorum int := public.cfg_int('quorum', 8);
  beta boolean := public.cfg_bool('beta_mode', true);
  beta_all_below int := public.cfg_int('beta_gallery_all_below', 15);
  xp_cap int := public.cfg_int('xp_daily_cap', 250);
  cb_mult int := public.cfg_int('comeback_multiplier', 2);
  gallery_n int;
  potd_id uuid;
  potd_user uuid;
  already_closed boolean;
  v record;
  su record;
  as_of_date date;
  drop_region text;
  wi int;
  li int;
  i int;
  j int;
  payload jsonb;
begin
  ids := array(
    select id from public.submissions
    where drop_id = p_drop and thumb_path is not null
    order by id
  );
  k := coalesce(array_length(ids, 1), 0);

  already_closed := exists (select 1 from public.galleries where drop_id = p_drop);

  update public.submissions
    set in_gallery = false, is_potd = false, gallery_rank = null
    where drop_id = p_drop;

  if k = 0 then
    insert into public.galleries (drop_id, payload)
    values (p_drop, jsonb_build_object('drop_id', p_drop, 'photos', '[]'::jsonb))
    on conflict (drop_id) do update set payload = excluded.payload, created_at = now();
    update public.prompt_drops set status = 'revealed' where id = p_drop;
    return jsonb_build_object('ok', true, 'submissions', 0, 'gallery', 0, 'potd', null);
  end if;

  wins  := array_fill(0::double precision, array[k]);
  ncomp := array_fill(0, array[k]);
  nmat  := array_fill(0::double precision, array[k, k]);
  s     := array_fill(1::double precision, array[k]);

  for v in
    select winner_id, loser_id from public.votes where drop_id = p_drop
  loop
    wi := array_position(ids, v.winner_id);
    li := array_position(ids, v.loser_id);
    if wi is null or li is null then continue; end if;
    wins[wi]     := wins[wi] + 1;
    ncomp[wi]    := ncomp[wi] + 1;
    ncomp[li]    := ncomp[li] + 1;
    nmat[wi][li] := nmat[wi][li] + 1;
    nmat[li][wi] := nmat[li][wi] + 1;
  end loop;

  news := array_fill(1::double precision, array[k]);
  for iter in 1..60 loop
    for i in 1..k loop
      denom := 1.0 / (s[i] + 1.0);
      for j in 1..k loop
        if nmat[i][j] > 0 then
          denom := denom + nmat[i][j] / (s[i] + s[j]);
        end if;
      end loop;
      numer := wins[i] + 0.5;
      news[i] := numer / denom;
    end loop;
    ln_sum := 0;
    for i in 1..k loop ln_sum := ln_sum + ln(news[i]); end loop;
    gm := exp(ln_sum / k);
    for i in 1..k loop s[i] := news[i] / gm; end loop;
  end loop;

  bt := array_fill(0::double precision, array[k]);
  ln_sum := 0;
  for i in 1..k loop
    bt[i] := ln(s[i]);
    ln_sum := ln_sum + bt[i];
  end loop;
  mu := ln_sum / k;
  score := array_fill(0::double precision, array[k]);
  for i in 1..k loop
    score[i] := mu + (bt[i] - mu) * ncomp[i]::double precision / (ncomp[i] + cval);
  end loop;

  gallery_n := ceil(k * gpct / 100.0);
  gallery_n := greatest(gallery_n, gmin);
  gallery_n := least(gallery_n, gmax);
  gallery_n := least(gallery_n, k);
  if beta and k < beta_all_below then
    gallery_n := k;
  end if;

  -- CHANGED: the rank was already being computed here and discarded. Keep it —
  -- it is what makes 'top10' a thing.
  with ranked as (
    select ids[idx] as id, score[idx] as sc,
           row_number() over (order by score[idx] desc, ncomp[idx] desc, ids[idx]) as rnk
    from generate_series(1, k) as gs(idx)
  )
  update public.submissions sub
    set bt_score = r.sc,
        in_gallery = (r.rnk <= gallery_n),
        gallery_rank = r.rnk
    from ranked r
    where sub.id = r.id;

  select id into potd_id from (
    select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
           case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
    from generate_series(1, k) as gs(idx)
  ) t
  where nc >= quorum
  order by sc desc, nc desc, wr desc
  limit 1;

  if potd_id is null then
    select id into potd_id from (
      select ids[idx] as id, score[idx] as sc, ncomp[idx] as nc,
             case when ncomp[idx] > 0 then wins[idx] / ncomp[idx] else 0 end as wr
      from generate_series(1, k) as gs(idx)
    ) t
    order by sc desc, nc desc, wr desc
    limit 1;
  end if;

  update public.submissions set is_potd = true where id = potd_id;

  -- CHANGED: winning a Photo of the Day unlocks the crown frame. This is the
  -- ONLY writer of user_frames — authenticated has no insert grant.
  select user_id into potd_user from public.submissions where id = potd_id;
  if potd_user is not null then
    insert into public.user_frames (user_id, frame_id)
    values (potd_user, 'crown')
    on conflict do nothing;
  end if;

  select jsonb_build_object(
           'drop_id', p_drop,
           'drop_date', pd.drop_date,
           'prompt', pr.text,
           'photos', coalesce((
             select jsonb_agg(
               jsonb_build_object(
                 'id', s2.id,
                 'thumb_path', s2.thumb_path,
                 'image_path', s2.image_path,
                 'user_id', s2.user_id,
                 'shooter', p2.username,
                 'hearts', s2.vote_count + s2.reaction_count,
                 'is_potd', s2.is_potd,
                 'bt_score', s2.bt_score,
                 'captured_at', s2.captured_at
               )
               order by s2.is_potd desc, s2.bt_score desc nulls last, s2.vote_count desc
             )
             from public.submissions s2
             join public.profiles p2 on p2.id = s2.user_id
             where s2.drop_id = p_drop and s2.in_gallery
           ), '[]'::jsonb)
         )
    into payload
  from public.prompt_drops pd
  join public.prompts pr on pr.id = pd.prompt_id
  where pd.id = p_drop;

  insert into public.galleries (drop_id, payload)
  values (p_drop, payload)
  on conflict (drop_id) do update set payload = excluded.payload, created_at = now();

  update public.prompt_drops set status = 'revealed' where id = p_drop;

  -- ---- streaks + XP (spec §10 · 4-of-7 rolling model) ---------------------
  if not already_closed then
    select drop_date, region into as_of_date, drop_region
      from public.prompt_drops where id = p_drop;

    update public.submissions s2
      set xp_awarded = least(
            20
            + (case when s2.quick_draw then 10  else 0 end)
            + s2.vote_count * 2
            + (case when s2.in_gallery then 50  else 0 end)
            + (case when s2.is_potd    then 100 else 0 end),
            xp_cap
          ) * (case when coalesce(st.comeback_pending, false) then cb_mult else 1 end)
      from public.streaks st
      where s2.drop_id = p_drop and s2.thumb_path is not null and st.user_id = s2.user_id;

    update public.profiles p
      set xp = p.xp + s2.xp_awarded
      from public.submissions s2
      where s2.drop_id = p_drop and s2.thumb_path is not null and s2.user_id = p.id;

    update public.streaks st
      set comeback_pending = false, updated_at = now()
    from public.submissions s2
    where s2.drop_id = p_drop and s2.thumb_path is not null
      and s2.user_id = st.user_id and st.comeback_pending;

    for su in
      select pr.id as uid
      from public.profiles pr
      join public.streaks stk on stk.user_id = pr.id
      where pr.region = drop_region
        and (stk.is_alive
             or stk.days_this_week > 0
             or exists (
               select 1 from public.submissions s3
               where s3.drop_id = p_drop and s3.user_id = pr.id and s3.thumb_path is not null
             ))
    loop
      perform public.evaluate_streak(su.uid, as_of_date);
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'submissions', k,
    'gallery', gallery_n,
    'potd', potd_id,
    'awarded_xp', not already_closed
  );
end;
$$;

revoke execute on function public.close_day(uuid) from public, anon;
grant  execute on function public.close_day(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Read paths carry frame + status + day
-- ---------------------------------------------------------------------------

-- get_gallery — identical to 20260712000007_moderation.sql except the photos
-- array is now decorated after the moderation filter.
create or replace function public.get_gallery(p_drop uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  g record;
  payload jsonb;
  cur_id uuid;
  is_seed boolean := false;
  past jsonb;
  nxt timestamptz;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into prof from public.profiles where id = uid;

  if p_drop is not null then
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.prompt_drops pd on pd.id = ga.drop_id
    where ga.drop_id = p_drop and pd.region = prof.region;
    if g.drop_id is not null then payload := g.payload; end if;
  else
    select ga.drop_id, ga.payload, pd.drop_date
      into g
    from public.galleries ga
    join public.prompt_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
    order by pd.drop_date desc
    limit 1;
    if g.drop_id is not null then payload := g.payload; end if;
  end if;

  if payload is null then
    select pd.id, pd.drop_date,
           case when pd.drops_at <= now() then pr.text else null end as prompt
      into g
    from public.prompt_drops pd
    join public.prompts pr on pr.id = pd.prompt_id
    where pd.region = prof.region
      and exists (select 1 from public.submissions s where s.drop_id = pd.id and s.thumb_path is not null)
    order by pd.drop_date desc
    limit 1;

    if g.id is null then
      return jsonb_build_object('drop', null, 'photos', '[]'::jsonb, 'is_seed', false,
                                'past', '[]'::jsonb, 'next_drop_at', null);
    end if;

    is_seed := true;
    payload := jsonb_build_object(
      'drop_id', g.id,
      'drop_date', g.drop_date,
      'prompt', g.prompt,
      'photos', coalesce((
        select jsonb_agg(obj order by rnk)
        from (
          select jsonb_build_object(
                   'id', s.id, 'thumb_path', s.thumb_path, 'image_path', s.image_path,
                   'user_id', s.user_id, 'shooter', pr.username,
                   'hearts', s.vote_count + s.reaction_count,
                   'is_potd', row_number() over (order by s.vote_count desc, s.id) = 1,
                   'bt_score', null, 'captured_at', s.captured_at
                 ) as obj,
                 row_number() over (order by s.vote_count desc, s.id) as rnk
          from public.submissions s
          join public.profiles pr on pr.id = s.user_id
          where s.drop_id = g.id and s.thumb_path is not null
          order by s.vote_count desc, s.id
          limit 24
        ) q
      ), '[]'::jsonb)
    );
  end if;

  cur_id := (payload ->> 'drop_id')::uuid;
  select coalesce(jsonb_agg(
           jsonb_build_object('drop_id', t.drop_id, 'drop_date', t.drop_date, 'prompt', t.prompt)
           order by t.drop_date desc
         ), '[]'::jsonb)
    into past
  from (
    select ga.drop_id, pd.drop_date, (ga.payload ->> 'prompt') as prompt
    from public.galleries ga
    join public.prompt_drops pd on pd.id = ga.drop_id
    where pd.region = prof.region
      and ga.drop_id <> cur_id
    order by pd.drop_date desc
    limit 30
  ) t;

  select pd.drops_at into nxt
  from public.prompt_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  return jsonb_build_object(
    'drop', jsonb_build_object(
      'id', payload ->> 'drop_id',
      'prompt', payload ->> 'prompt',
      'drop_date', payload ->> 'drop_date',
      'day_number', (select day_number from public.prompt_drops where id = cur_id)
    ),
    'photos', public.decorate_photos(public.filter_public_photos(payload -> 'photos', uid)),
    'is_seed', is_seed,
    'past', past,
    'next_drop_at', nxt
  );
end;
$$;

revoke execute on function public.get_gallery(uuid) from public, anon;
grant  execute on function public.get_gallery(uuid) to authenticated;

-- get_following_gallery — same, decorated.
create or replace function public.get_following_gallery()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  photos jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select coalesce(jsonb_agg(row order by dd desc, potd desc, hearts desc), '[]'::jsonb)
    into photos
  from (
    select jsonb_build_object(
             'id', s.id,
             'thumb_path', s.thumb_path,
             'image_path', s.image_path,
             'user_id', s.user_id,
             'shooter', pr.username,
             'hearts', s.vote_count + s.reaction_count,
             'is_potd', s.is_potd,
             'captured_at', s.captured_at,
             'drop_date', pd.drop_date
           ) as row,
           pd.drop_date as dd, s.is_potd as potd, (s.vote_count + s.reaction_count) as hearts
    from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    join public.profiles pr on pr.id = s.user_id
    where s.in_gallery
      and s.user_id in (select followee_id from public.follows where follower_id = me)
    order by pd.drop_date desc, s.is_potd desc, (s.vote_count + s.reaction_count) desc
    limit 60
  ) q;

  return jsonb_build_object(
    'photos', public.decorate_photos(public.filter_public_photos(photos, me))
  );
end;
$$;

revoke execute on function public.get_following_gallery() from public, anon;
grant  execute on function public.get_following_gallery() to authenticated;

-- get_profile — the wins wall is a photo array too, so it decorates the same way.
-- Also returns the profile's own equipped_frame and its unlocked frames (the
-- equip picker needs to know whether crown is selectable).
create or replace function public.get_profile(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  prof public.profiles%rowtype;
  st public.streaks%rowtype;
  galleries int;
  crowns int;
  hearts int;
  wins jsonb;
  owned jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  target := coalesce(p_user, me);

  select * into prof from public.profiles where id = target;
  if prof.id is null then
    return jsonb_build_object('found', false);
  end if;

  select * into st from public.streaks where user_id = target;
  select count(*) into galleries from public.submissions where user_id = target and in_gallery;
  select count(*) into crowns   from public.submissions where user_id = target and is_potd;
  select coalesce(sum(vote_count + reaction_count), 0) into hearts
    from public.submissions where user_id = target;

  select coalesce(jsonb_agg(
           jsonb_build_object('id', id, 'thumb_path', thumb_path, 'is_potd', is_potd,
                              'user_id', target, 'drop_date', dd)
           order by dd desc
         ), '[]'::jsonb)
    into wins
  from (
    select s.id, s.thumb_path, s.is_potd, pd.drop_date as dd
    from public.submissions s
    join public.prompt_drops pd on pd.id = s.drop_id
    where s.user_id = target and s.in_gallery
    order by pd.drop_date desc
    limit 24
  ) w;

  -- Only the viewer's own unlocks — you never see what frames someone else owns,
  -- just the one they have equipped.
  select coalesce(jsonb_agg(frame_id), '[]'::jsonb) into owned
  from public.user_frames where user_id = me;

  return jsonb_build_object(
    'found', true,
    'id', target,
    'username', prof.username,
    'avatar_url', prof.avatar_url,
    'xp', prof.xp,
    'galleries', galleries,
    'streak_weeks', coalesce(st.current_weeks, 0),
    'hearts', hearts,
    'crowns', crowns,
    'wins', public.decorate_photos(public.filter_public_photos(wins, me)),
    'equipped_frame', prof.equipped_frame,
    'owned_frames', owned,
    'is_self', target = me,
    'is_following', exists (select 1 from public.follows where follower_id = me and followee_id = target)
  );
end;
$$;

revoke execute on function public.get_profile(uuid) from public, anon;
grant  execute on function public.get_profile(uuid) to authenticated;

-- get_home_state — Today renders three framed photos (the shot in flight, the
-- closed result, yesterday's PotD), so each needs a day, a status, and a frame.
create or replace function public.get_home_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  cur record;
  nxt timestamptz;
  s record;
  potd record;
  st public.streaks%rowtype;
  latest_rev record;
  res record;
  drop_json jsonb := null;
  sub_json jsonb := null;
  potd_json jsonb := null;
  streak_json jsonb := null;
  result_json jsonb := null;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into prof from public.profiles where id = uid;

  select pd.id, pd.drops_at, pd.submit_closes_at, pd.voting_closes_at, pd.day_number,
         p.text as prompt, p.category as category
    into cur
  from public.prompt_drops pd
  join public.prompts p on p.id = pd.prompt_id
  where pd.region = prof.region
    and now() >= pd.drops_at
    and now() < pd.voting_closes_at
  order by pd.drops_at desc
  limit 1;

  select pd.drops_at into nxt
  from public.prompt_drops pd
  where pd.region = prof.region and pd.drops_at > now()
  order by pd.drops_at asc
  limit 1;

  if cur.id is not null then
    drop_json := jsonb_build_object(
      'id', cur.id,
      'prompt', cur.prompt,
      'category', cur.category,
      'drops_at', cur.drops_at,
      'submit_closes_at', cur.submit_closes_at,
      'voting_closes_at', cur.voting_closes_at,
      'day_number', cur.day_number,
      'is_live', (now() < cur.submit_closes_at)
    );

    select sub.id, sub.captured_at, sub.image_path, sub.thumb_path,
           sub.vote_count, sub.reaction_count, sub.quick_draw, sub.in_gallery,
           sub.is_potd, sub.gallery_rank
      into s
    from public.submissions sub
    where sub.drop_id = cur.id and sub.user_id = uid;

    if s.id is not null then
      sub_json := jsonb_build_object(
        'id', s.id,
        'captured_at', s.captured_at,
        'image_path', s.image_path,
        'thumb_path', s.thumb_path,
        'vote_count', s.vote_count,
        'reaction_count', s.reaction_count,
        'quick_draw', s.quick_draw,
        'in_gallery', s.in_gallery,
        'is_potd', s.is_potd,
        'status', public.photo_status(s.is_potd, s.gallery_rank),
        'day_number', cur.day_number
      );
    end if;
  end if;

  select s2.id, s2.drop_id, s2.thumb_path, s2.is_potd, s2.gallery_rank,
         pd2.day_number,
         (s2.vote_count + s2.reaction_count) as hearts,
         pr.username as shooter, pr.equipped_frame as frame
    into potd
  from public.submissions s2
  join public.prompt_drops pd2 on pd2.id = s2.drop_id
  join public.profiles pr on pr.id = s2.user_id
  where pd2.region = prof.region and s2.is_potd = true
  order by pd2.drop_date desc
  limit 1;

  if potd.id is null then
    select s3.id, s3.drop_id, s3.thumb_path, s3.is_potd, s3.gallery_rank,
           pd3.day_number,
           (s3.vote_count + s3.reaction_count) as hearts,
           pr.username as shooter, pr.equipped_frame as frame
      into potd
    from public.submissions s3
    join public.prompt_drops pd3 on pd3.id = s3.drop_id
    join public.profiles pr on pr.id = s3.user_id
    where pd3.region = prof.region
    order by pd3.drop_date desc, s3.vote_count desc
    limit 1;
  end if;

  if potd.id is not null then
    potd_json := jsonb_build_object(
      'submission_id', potd.id,
      'drop_id', potd.drop_id,
      'thumb_path', potd.thumb_path,
      'hearts', potd.hearts,
      'shooter', potd.shooter,
      'equipped_frame', potd.frame,
      'day_number', potd.day_number,
      'status', public.photo_status(potd.is_potd, potd.gallery_rank)
    );
  end if;

  select * into st from public.streaks where user_id = uid;
  if st.user_id is not null then
    streak_json := jsonb_build_object(
      'current_weeks', st.current_weeks,
      'days_this_week', st.days_this_week,
      'shields', st.shields,
      'is_alive', st.is_alive
    );
  end if;

  select pd.id as drop_id, pd.drop_date, pd.day_number
    into latest_rev
  from public.prompt_drops pd
  where pd.region = prof.region and pd.status = 'revealed'
  order by pd.drop_date desc
  limit 1;

  if latest_rev.drop_id is not null then
    select sub.thumb_path, sub.image_path,
           (sub.vote_count + sub.reaction_count) as hearts,
           sub.in_gallery, sub.is_potd, sub.gallery_rank, sub.xp_awarded
      into res
    from public.submissions sub
    where sub.drop_id = latest_rev.drop_id and sub.user_id = uid and sub.thumb_path is not null;

    if res.thumb_path is not null then
      result_json := jsonb_build_object(
        'drop_id', latest_rev.drop_id,
        'drop_date', latest_rev.drop_date,
        'day_number', latest_rev.day_number,
        'thumb_path', res.thumb_path,
        'hearts', res.hearts,
        'in_gallery', res.in_gallery,
        'is_potd', res.is_potd,
        'status', public.photo_status(res.is_potd, res.gallery_rank),
        'xp_awarded', res.xp_awarded
      );
    end if;
  end if;

  return jsonb_build_object(
    'drop', drop_json,
    'next_drop_at', nxt,
    'submission', sub_json,
    'yesterday_potd', potd_json,
    'streak', streak_json,
    'xp', prof.xp,
    'equipped_frame', prof.equipped_frame,
    'last_result', result_json
  );
end;
$$;

revoke execute on function public.get_home_state() from public, anon;
grant execute on function public.get_home_state() to authenticated;
