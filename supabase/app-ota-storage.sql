-- Public OTA bucket for Windows + Android web-asset updates.
-- Run once in the Supabase SQL editor. Uploads use the service role from scripts/publish-ota.mjs.

insert into storage.buckets (id, name, public)
values ('app-ota', 'app-ota', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public read app-ota" on storage.objects;
create policy "Public read app-ota"
on storage.objects
for select
to public
using (bucket_id = 'app-ota');
