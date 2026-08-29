alter table public.profiles
  add constraint username_format check (username ~ '^[a-z0-9_]{3,20}$');

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'u_' || substr(md5(new.id::text || clock_timestamp()::text), 1, 18)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create or replace function public.is_username_available(check_username text)
returns boolean as $$
  select not exists (select 1 from public.profiles where username = check_username);
$$ language sql security definer set search_path = '';

grant execute on function public.is_username_available(text) to anon, authenticated;
