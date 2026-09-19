-- Staff payout ledger (amount + date). Safe to re-run.
alter table public.staff
  add column if not exists payouts jsonb not null default '[]'::jsonb;
