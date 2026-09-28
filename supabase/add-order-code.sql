-- Unique customer order number (OR-001), separate from cloth piece codes (CL-001).
-- Run once in the Supabase SQL Editor.

alter table public.cloths
  add column if not exists order_code text not null default '';

create index if not exists cloths_user_id_order_code_idx
  on public.cloths (user_id, order_code);

-- Copy any codes already stored in measurement_checks JSON.
update public.cloths
set order_code = trim(measurement_checks->>'orderCode')
where coalesce(order_code, '') = ''
  and coalesce(trim(measurement_checks->>'orderCode'), '') <> '';

-- Assign stable OR-xxx numbers to remaining order groups.
with grouped as (
  select
    id,
    coalesce(
      nullif(trim(measurement_checks->>'orderBatchId'), ''),
      lower(trim(customer_name)) || '|' ||
        coalesce(given_date::text, '') || '|' ||
        coalesce(trim(notes), '') || '|' ||
        coalesce(total_amount::text, '0') || '|' ||
        coalesce(discount_amount::text, '0') || '|' ||
        coalesce(advance_amount::text, '0')
    ) as grp,
    created_at
  from public.cloths
),
firsts as (
  select grp, min(created_at) as first_at
  from grouped
  group by grp
),
numbered as (
  select
    grp,
    'OR-' || lpad(row_number() over (order by first_at, grp)::text, 3, '0') as next_code
  from firsts
)
update public.cloths c
set order_code = n.next_code
from grouped g
join numbered n on n.grp = g.grp
where c.id = g.id
  and coalesce(c.order_code, '') = '';
