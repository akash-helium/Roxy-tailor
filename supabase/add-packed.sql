-- Packed-for-pickup flag on each cloth (run once in Supabase SQL Editor).
-- The app also stores this in measurement_checks if the column is missing.

alter table public.cloths
  add column if not exists packed boolean not null default false;
