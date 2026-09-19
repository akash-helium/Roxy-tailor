-- Allow multiple cloth pieces in one customer order to share the same barcode code.
-- Without this, registering 2+ pieces with one order barcode fails with:
--   duplicate key value violates unique constraint "cloths_user_id_code_key"

alter table public.cloths drop constraint if exists cloths_user_id_code_key;

-- Drop any other unique constraint/index on (user_id, code) if renamed.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'cloths'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%user_id%code%'
  loop
    execute format('alter table public.cloths drop constraint if exists %I', r.conname);
  end loop;
end $$;

create index if not exists cloths_user_id_code_idx on public.cloths (user_id, code);
