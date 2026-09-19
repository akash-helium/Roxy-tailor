-- Per-staff payment columns on cloths (run once in Supabase SQL Editor)

alter table public.cloths
  add column if not exists cutter_pay_amount numeric(12, 2) not null default 0,
  add column if not exists cutter_pay_advance numeric(12, 2) not null default 0,
  add column if not exists cutter_pay_final numeric(12, 2) not null default 0,
  add column if not exists cutter_pay_remarks text not null default '',
  add column if not exists tailor_pay_amount numeric(12, 2) not null default 0,
  add column if not exists tailor_pay_advance numeric(12, 2) not null default 0,
  add column if not exists tailor_pay_final numeric(12, 2) not null default 0,
  add column if not exists tailor_pay_remarks text not null default '';
