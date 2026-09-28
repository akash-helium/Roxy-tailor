-- Run this entire file in Supabase → SQL Editor
-- Creates profiles, staff, cloths tables + RLS policies

-- ─── Shared helpers ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Profiles (auth user) ─────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  login_id text not null unique,
  display_name text not null default 'Shop Admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can read own profile" on public.profiles;
create policy "Authenticated users can read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Authenticated users can update own profile" on public.profiles;
create policy "Authenticated users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, login_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'login_id', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Shop Admin')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── Enums ────────────────────────────────────────────────────────
do $$ begin
  create type public.staff_type as enum ('cutter', 'tailor');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.cloth_status as enum ('cutting', 'ready_to_sew', 'sewing', 'completed');
exception when duplicate_object then null;
end $$;

-- ─── Staff ────────────────────────────────────────────────────────
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type public.staff_type not null,
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.staff
  add column if not exists payouts jsonb not null default '[]'::jsonb;

create index if not exists staff_user_id_idx on public.staff (user_id);

alter table public.staff enable row level security;

drop policy if exists "Users manage own staff" on public.staff;
create policy "Users manage own staff"
  on public.staff for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Cloths ───────────────────────────────────────────────────────
create table if not exists public.cloths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  customer_name text not null,
  customer_phone text not null default '',
  garment text not null,
  garment_type text not null default '',
  gender text not null default 'male',
  fabric_color text not null,
  size text not null default '',
  measurements jsonb not null default '{}'::jsonb,
  measurement_checks jsonb not null default '{}'::jsonb,
  measurement_image text,
  notes text not null default '',
  status public.cloth_status not null default 'cutting',
  cutter_id uuid references public.staff (id) on delete set null,
  tailor_id uuid references public.staff (id) on delete set null,
  total_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  advance_amount numeric(12, 2) not null default 0,
  final_payment_amount numeric(12, 2) not null default 0,
  cutter_pay_amount numeric(12, 2) not null default 0,
  cutter_pay_advance numeric(12, 2) not null default 0,
  cutter_pay_final numeric(12, 2) not null default 0,
  cutter_pay_remarks text not null default '',
  tailor_pay_amount numeric(12, 2) not null default 0,
  tailor_pay_advance numeric(12, 2) not null default 0,
  tailor_pay_final numeric(12, 2) not null default 0,
  tailor_pay_remarks text not null default '',
  given_date date,
  cutter_expected_date date,
  tailor_expected_date date,
  order_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloths_user_id_idx on public.cloths (user_id);
create index if not exists cloths_code_idx on public.cloths (code);
create index if not exists cloths_user_id_code_idx on public.cloths (user_id, code);
create index if not exists cloths_user_id_order_code_idx on public.cloths (user_id, order_code);

alter table public.cloths enable row level security;

drop policy if exists "Users manage own cloths" on public.cloths;
create policy "Users manage own cloths"
  on public.cloths for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists cloths_updated_at on public.cloths;
create trigger cloths_updated_at
  before update on public.cloths
  for each row execute function public.set_updated_at();

-- ─── Realtime (optional – skip if this errors) ─────────────────────
-- alter publication supabase_realtime add table public.staff;
-- alter publication supabase_realtime add table public.cloths;

-- ─── Default login user: admin / tailor123 ──────────────────────────
create extension if not exists pgcrypto;

do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'admin@example.com') then
    raise notice 'Default admin user already exists.';
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    email_change_token_current
  ) values (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.com',
    crypt('tailor123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"login_id":"admin","display_name":"Shop Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    new_user_id::text,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@example.com'),
    'email',
    now(),
    now(),
    now()
  );
end $$;
