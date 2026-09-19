-- Add payment columns to cloths (run once in Supabase SQL Editor)

alter table public.cloths
  add column if not exists total_amount numeric(12, 2) not null default 0,
  add column if not exists advance_amount numeric(12, 2) not null default 0,
  add column if not exists final_payment_amount numeric(12, 2) not null default 0;
