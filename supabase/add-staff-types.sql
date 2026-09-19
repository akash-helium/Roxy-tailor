-- Configurable staff types (run once in Supabase SQL Editor)
-- Default types: cutter + tailor (cannot be deleted in admin)

create table if not exists public.staff_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  label text not null,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists staff_types_user_id_idx on public.staff_types (user_id);

alter table public.staff_types enable row level security;

drop policy if exists "Shop staff types access" on public.staff_types;
create policy "Shop staff types access"
  on public.staff_types
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Allow custom staff types beyond cutter / tailor
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff'
      and column_name = 'type'
      and udt_name = 'staff_type'
  ) then
    alter table public.staff alter column type type text using type::text;
  end if;
end $$;
