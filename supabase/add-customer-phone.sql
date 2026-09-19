-- Customer WhatsApp number on each cloth/order (run once in Supabase SQL Editor)

alter table public.cloths
  add column if not exists customer_phone text not null default '';
