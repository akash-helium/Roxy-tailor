-- Staff & cloth workflow tables

create type if not exists public.staff_type as enum ('cutter', 'tailor');
create type if not exists public.cloth_status as enum ('cutting', 'ready_to_sew', 'sewing', 'completed');

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type public.staff_type not null,
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.cloths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  customer_name text not null,
  garment text not null,
  fabric_color text not null,
  notes text not null default '',
  status public.cloth_status not null default 'cutting',
  cutter_id uuid references public.staff (id) on delete set null,
  tailor_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists staff_user_id_idx on public.staff (user_id);
create index if not exists cloths_user_id_idx on public.cloths (user_id);
create index if not exists cloths_code_idx on public.cloths (code);

alter table public.staff enable row level security;
alter table public.cloths enable row level security;

drop policy if exists "Users manage own staff" on public.staff;
create policy "Users manage own staff"
  on public.staff
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own cloths" on public.cloths;
create policy "Users manage own cloths"
  on public.cloths
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists cloths_updated_at on public.cloths;
create trigger cloths_updated_at
  before update on public.cloths
  for each row
  execute function public.set_updated_at();

-- Realtime for live updates across tabs/devices
alter publication supabase_realtime add table public.staff;
alter publication supabase_realtime add table public.cloths;
