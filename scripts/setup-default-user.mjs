/**
 * Creates the single default shop admin user in Supabase Auth.
 *
 * Usage:
 *   1. Run supabase/migrations/001_profiles.sql in the Supabase SQL editor first.
 *   2. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local (or export them).
 *   3. node scripts/setup-default-user.mjs
 *
 * Default credentials:
 *   Login ID: admin
 *   Password: tailor123
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_LOGIN_ID = 'admin';
const DEFAULT_PASSWORD = 'tailor123';
const DEFAULT_EMAIL = 'admin@example.com';

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const contents = readFileSync(envPath, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!process.env[key]) {
        process.env[key] = rest.join('=').trim();
      }
    }
  } catch {
    // .env.local is optional when vars are exported in the shell
  }
}

loadEnv();

const url =
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

if (listError) {
  console.error('Failed to list users:', listError.message);
  process.exit(1);
}

const existing = existingUsers.users.find(
  (user) => user.email === DEFAULT_EMAIL || user.user_metadata?.login_id === DEFAULT_LOGIN_ID,
);

if (existing) {
  console.log('Default user already exists.');
  console.log(`  Login ID: ${DEFAULT_LOGIN_ID}`);
  console.log(`  User ID:  ${existing.id}`);
  process.exit(0);
}

const { data, error } = await supabase.auth.admin.createUser({
  email: DEFAULT_EMAIL,
  password: DEFAULT_PASSWORD,
  email_confirm: true,
  user_metadata: {
    login_id: DEFAULT_LOGIN_ID,
    display_name: 'Shop Admin',
  },
});

if (error) {
  console.error('Failed to create default user:', error.message);
  process.exit(1);
}

console.log('Default user created successfully.');
console.log(`  Login ID: ${DEFAULT_LOGIN_ID}`);
console.log(`  Password: ${DEFAULT_PASSWORD}`);
console.log(`  User ID:  ${data.user.id}`);
