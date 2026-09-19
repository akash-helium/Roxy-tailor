/**
 * Prints SQL to drop cloths unique(user_id, code) so multi-piece orders
 * can share one barcode. Run in Supabase Dashboard → SQL Editor.
 *
 * Usage: node scripts/fix-shared-order-code.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/003_shared_order_code.sql'),
  'utf8',
);

function loadEnv() {
  const contents = readFileSync(resolve('.env.local'), 'utf8');
  const env = {};
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    env[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL ?? '';
const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

console.log('\n=== Multi-cloth shared barcode DB fix ===\n');
console.log('Open Supabase SQL Editor and run the migration below.');
if (projectRef) {
  console.log(`Dashboard: https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
}
console.log(sql);
console.log('\nUntil this runs, the app still registers multiple pieces using unique codes');
console.log('(order scan/print still groups them together).\n');
