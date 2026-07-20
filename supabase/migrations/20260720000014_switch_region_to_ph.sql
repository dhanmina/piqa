-- Switch default region from BETA to PH for drop_prompt.
create or replace function public.drop_prompt(p_region text default 'PH')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_local date := (now() at time zone 'Asia/Manila')::date;
  chosen record;
  drops_at timestamptz;
  submit_close timestamptz;
  voting_close timestamptz;
  new_drop_id uuid;
begin
  if exists (select 1 from public.prompt_drops where region = p_region and drop_date = today_local) then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'exists');
  end if;

  select id, text into chosen
  from public.prompts
  order by used_at asc nulls first, seq asc nulls last, random()
  limit 1;

  if chosen.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_prompts');
  end if;

  drops_at     := ((today_local + time '06:00') at time zone 'Asia/Manila')
                  + make_interval(mins => floor(random() * 60)::int);
  submit_close := ((today_local + time '18:00') at time zone 'Asia/Manila');
  voting_close := ((today_local + time '19:00') at time zone 'Asia/Manila');

  insert into public.prompt_drops
    (prompt_id, region, drop_date, drops_at, submit_closes_at, voting_closes_at, status)
  values
    (chosen.id, p_region, today_local, drops_at, submit_close, voting_close, 'scheduled')
  on conflict (region, drop_date) do nothing
  returning id into new_drop_id;

  update public.prompts set used_at = today_local where id = chosen.id;

  return jsonb_build_object('ok', true, 'created', true, 'drop_id', new_drop_id, 'drops_at', drops_at);
end;
$$;
