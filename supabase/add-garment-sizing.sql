-- Garment sizing + IN Group flag (run once in Supabase SQL Editor)

alter table public.cloths
  add column if not exists garment_type text not null default '',
  add column if not exists gender text not null default 'male',
  add column if not exists measurements jsonb not null default '{}'::jsonb,
  add column if not exists measurement_checks jsonb not null default '{}'::jsonb,
  add column if not exists measurement_image text;
