-- Per-staff expected dates on cloths (run once in Supabase SQL Editor)

alter table public.cloths
  add column if not exists given_date date,
  add column if not exists cutter_expected_date date,
  add column if not exists tailor_expected_date date;

-- Migrate old single expected_date column if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cloths'
      and column_name = 'expected_date'
  ) then
    update public.cloths
    set cutter_expected_date = coalesce(cutter_expected_date, expected_date)
    where cutter_expected_date is null and expected_date is not null;
  end if;
end $$;
