-- Size column on cloths (run once in Supabase SQL Editor)

alter table public.cloths
  add column if not exists size text not null default '';
