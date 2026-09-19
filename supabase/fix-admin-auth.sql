-- Repair cloud login for admin / tailor123
-- Run in Supabase → SQL Editor if Sign In shows "Database error querying schema"

create extension if not exists pgcrypto;

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'admin@example.com';

  if uid is null then
    select id into uid from public.profiles where login_id = 'admin';
  end if;

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      email_change_token_current
    ) values (
      uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'admin@example.com',
      crypt('tailor123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"login_id":"admin","display_name":"Shop Admin"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
    set
      encrypted_password = crypt('tailor123', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      banned_until = null,
      deleted_at = null,
      confirmation_token = '',
      recovery_token = '',
      email_change = '',
      email_change_token_new = '',
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"login_id":"admin","display_name":"Shop Admin"}'::jsonb,
      updated_at = now()
    where id = uid;
  end if;

  insert into public.profiles (id, login_id, display_name)
  values (uid, 'admin', 'Shop Admin')
  on conflict (id) do update
    set login_id = excluded.login_id,
        display_name = excluded.display_name;

  if not exists (
    select 1 from auth.identities
    where user_id = uid and provider = 'email'
  ) then
    insert into auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      uid::text,
      uid,
      jsonb_build_object('sub', uid::text, 'email', 'admin@example.com'),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  raise notice 'Admin login repaired: admin / tailor123 (user %)', uid;
end $$;
