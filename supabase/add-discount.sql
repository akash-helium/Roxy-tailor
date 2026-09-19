-- Add customer discount column to cloths (run once in Supabase SQL Editor)

alter table public.cloths
  add column if not exists discount_amount numeric(12, 2) not null default 0;
