-- Run once in Supabase SQL Editor if staff/cloths sync or admin shows empty
-- Adds all columns the mobile app and admin expect

alter table public.cloths
  add column if not exists size text not null default '';

alter table public.cloths
  add column if not exists total_amount numeric(12, 2) not null default 0,
  add column if not exists advance_amount numeric(12, 2) not null default 0,
  add column if not exists final_payment_amount numeric(12, 2) not null default 0;

alter table public.cloths
  add column if not exists cutter_pay_amount numeric(12, 2) not null default 0,
  add column if not exists cutter_pay_advance numeric(12, 2) not null default 0,
  add column if not exists cutter_pay_final numeric(12, 2) not null default 0,
  add column if not exists cutter_pay_remarks text not null default '',
  add column if not exists tailor_pay_amount numeric(12, 2) not null default 0,
  add column if not exists tailor_pay_advance numeric(12, 2) not null default 0,
  add column if not exists tailor_pay_final numeric(12, 2) not null default 0,
  add column if not exists tailor_pay_remarks text not null default '';

alter table public.cloths
  add column if not exists given_date date,
  add column if not exists cutter_expected_date date,
  add column if not exists tailor_expected_date date;

alter table public.cloths
  add column if not exists discount_amount numeric(12, 2) not null default 0;

alter table public.cloths
  add column if not exists garment_type text not null default '',
  add column if not exists gender text not null default 'male',
  add column if not exists measurements jsonb not null default '{}'::jsonb,
  add column if not exists measurement_checks jsonb not null default '{}'::jsonb,
  add column if not exists measurement_image text;

-- Shared access (app + admin same API key)
drop policy if exists "Users manage own staff" on public.staff;
drop policy if exists "Shop staff access" on public.staff;
create policy "Shop staff access"
  on public.staff for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "Users manage own cloths" on public.cloths;
drop policy if exists "Shop cloths access" on public.cloths;
create policy "Shop cloths access"
  on public.cloths for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "Read shop admin profile" on public.profiles;
create policy "Read shop admin profile"
  on public.profiles for select to anon, authenticated
  using (login_id = 'admin');

-- Configurable cloth types (admin + mobile app)
create table if not exists public.garment_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  label text not null,
  gender text not null check (gender in ('male', 'female')),
  fields jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists garment_types_user_id_idx on public.garment_types (user_id);
alter table public.garment_types enable row level security;

drop policy if exists "Shop garment types access" on public.garment_types;
create policy "Shop garment types access"
  on public.garment_types for all to anon, authenticated
  using (true) with check (true);

-- Configurable staff types (admin + mobile app)
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
  on public.staff_types for all to anon, authenticated
  using (true) with check (true);

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
