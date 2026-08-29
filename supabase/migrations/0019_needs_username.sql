alter table public.profiles
  add column needs_username boolean not null default false;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url, needs_username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'u_' || substr(md5(new.id::text || clock_timestamp()::text), 1, 18)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username' is null
  );
  insert into public.streaks (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = '';
