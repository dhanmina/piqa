-- Delete was never granted for captures (0002_captures.sql only granted
-- select/insert) -- there was no delete path in the app until now.
create policy "captures_delete_own" on public.captures
  for delete using (auth.uid() = user_id);

grant delete on public.captures to authenticated;

create policy "captures_storage_delete_own" on storage.objects
  for delete using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deletes one capture row. If it was the day's only remaining capture AND
-- that day was the front of the user's current streak (captures.captured_at
-- = streaks.last_capture_date), rolls current_count/last_capture_date back
-- to the prior consecutive run (capture-or-frozen-date walk, same shape as
-- get_today_state's gap-freezing loop in 0003_streaks.sql). Deleting an
-- older day mid-history that isn't the streak's front intentionally leaves
-- current_count/longest_count untouched -- full historical re-derivation is
-- out of scope for this pass.
--
-- Returns the deleted row's storage_path so the caller can remove the file
-- from the storage bucket. This function only touches DB rows -- deleting
-- from storage.objects directly here would drop the metadata row but not
-- the underlying object bytes, since Storage isn't a plain Postgres table.
create function public.delete_capture(p_capture_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_storage_path text;
  v_captured_at date;
  v_owner_id uuid;
  v_remaining int;
  v_last_capture_date date;
  v_run_date date;
  v_current_count int;
begin
  select storage_path, captured_at, user_id into v_storage_path, v_captured_at, v_owner_id
  from public.captures where id = p_capture_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Capture not found';
  end if;

  delete from public.captures where id = p_capture_id;

  select count(*) into v_remaining from public.captures
    where user_id = auth.uid() and captured_at = v_captured_at;

  if v_remaining = 0 then
    select last_capture_date into v_last_capture_date from public.streaks where user_id = auth.uid();

    if v_last_capture_date = v_captured_at then
      v_run_date := v_captured_at - 1;
      v_current_count := 0;
      while exists(select 1 from public.captures where user_id = auth.uid() and captured_at = v_run_date)
         or exists(select 1 from public.frozen_dates where user_id = auth.uid() and date = v_run_date) loop
        v_current_count := v_current_count + 1;
        v_run_date := v_run_date - 1;
      end loop;

      update public.streaks
        set current_count = v_current_count,
            last_capture_date = (select max(captured_at) from public.captures where user_id = auth.uid())
        where user_id = auth.uid();
    end if;
  end if;

  return v_storage_path;
end;
$$;
