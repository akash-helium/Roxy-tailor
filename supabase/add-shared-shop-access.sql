-- Shared shop data access for app + admin (run once in Supabase SQL Editor)
-- Lets the mobile app and admin panel share the same staff & cloths in the cloud.

drop policy if exists "Users manage own staff" on public.staff;
create policy "Shop staff access"
  on public.staff
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Users manage own cloths" on public.cloths;
create policy "Shop cloths access"
  on public.cloths
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Read shop admin profile" on public.profiles;
create policy "Read shop admin profile"
  on public.profiles
  for select
  to anon, authenticated
  using (login_id = 'admin');
