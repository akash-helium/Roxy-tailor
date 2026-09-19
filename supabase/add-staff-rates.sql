-- Per cloth-type rates keyed by staff type slug, plus per-cloth job snapshots.

alter table public.garment_types
  add column if not exists staff_rates jsonb not null default '{}'::jsonb;

alter table public.cloths
  add column if not exists staff_jobs jsonb not null default '[]'::jsonb;
