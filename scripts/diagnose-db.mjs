import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  const contents = readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=').trim();
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const anon = createClient(url, anonKey);

console.log('=== ANON KEY (same as app + admin) ===');
const { data: profiles, error: pErr } = await anon.from('profiles').select('*');
console.log('profiles:', pErr?.message ?? profiles?.length, profiles);

const { data: staff, error: sErr } = await anon.from('staff').select('*');
console.log('staff:', sErr?.message ?? staff?.length, staff);

const { data: cloths, error: cErr } = await anon.from('cloths').select('*');
console.log('cloths:', cErr?.message ?? cloths?.length, cloths);

const shopUserId = profiles?.[0]?.id;
if (shopUserId) {
  const testId = crypto.randomUUID();
  const { error: insErr } = await anon.from('staff').insert({
    id: testId,
    user_id: shopUserId,
    name: '__rls_test__',
    type: 'cutter',
  });
  console.log('anon insert test:', insErr?.code ?? 'ok', insErr?.message ?? 'inserted');
  if (!insErr) {
    const { data: after } = await anon.from('staff').select('id,name');
    console.log('anon select after insert:', after?.length, after);
    await anon.from('staff').delete().eq('id', testId);
  }
}

if (serviceKey) {
  console.log('\n=== SERVICE ROLE (all rows, bypasses RLS) ===');
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: allStaff } = await admin.from('staff').select('id,name,user_id');
  const { data: allCloths } = await admin.from('cloths').select('id,code,customer_name,user_id');
  console.log('staff rows:', allStaff?.length ?? 0, allStaff);
  console.log('cloths rows:', allCloths?.length ?? 0, allCloths);
} else {
  console.log('\n(no SUPABASE_SERVICE_ROLE_KEY — cannot bypass RLS to count hidden rows)');
}
