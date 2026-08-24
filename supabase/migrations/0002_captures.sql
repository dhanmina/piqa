create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  theme_tag text,
  captured_at date not null,
  created_at timestamptz not null default now()
);

create index captures_user_date_idx on public.captures (user_id, captured_at);

alter table public.captures enable row level security;

create policy "captures_select_own" on public.captures
  for select using (auth.uid() = user_id);

create policy "captures_insert_own" on public.captures
  for insert with check (auth.uid() = user_id);

grant select, insert on public.captures to authenticated;

insert into storage.buckets (id, name, public) values ('captures', 'captures', false);

create policy "captures_storage_select_own" on storage.objects
  for select using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "captures_storage_insert_own" on storage.objects
  for insert with check (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);
