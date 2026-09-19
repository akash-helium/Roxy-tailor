-- Creates default manager login: admin / tailor123
-- Run in Supabase → SQL Editor (once)

create extension if not exists pgcrypto;

do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'admin@example.com') then
    raise notice 'Default admin user already exists.';
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    email_change_token_current
  ) values (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.com',
    crypt('tailor123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"login_id":"admin","display_name":"Shop Admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

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
    new_user_id::text,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@example.com'),
    'email',
    now(),
    now(),
    now()
  );

  raise notice 'Default admin user created: admin / tailor123';
end $$;
