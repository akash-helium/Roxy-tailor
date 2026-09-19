/**
 * Install APK, launch app, login via adb, verify Supabase receives data.
 * Usage: node scripts/device-test-cloud.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = 'com.tailor.app';
const ACTIVITY = `${PKG}/.MainActivity`;
const APK = resolve('android/app/build/outputs/apk/debug/app-debug.apk');
const LOGIN_ID = 'admin';
const PASSWORD = 'tailor123';

function adb(...args) {
  return execSync(['adb', ...args].join(' '), { encoding: 'utf8' }).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnv() {
  const contents = readFileSync(resolve('.env.local'), 'utf8');
  const env = {};
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=').trim();
  }
  return env;
}

function getDevice() {
  const lines = adb('devices').split('\n').slice(1);
  const device = lines.find((l) => l.includes('\tdevice'));
  if (!device) throw new Error('No Android device connected (usb debugging on?)');
  return device.split('\t')[0];
}

function getScreenSize() {
  const out = adb('shell', 'wm', 'size');
  const m = out.match(/(\d+)x(\d+)/);
  if (!m) return { w: 1080, h: 2400, top: 120 };
  return { w: Number(m[1]), h: Number(m[2]), top: 120 };
}

function contentY(screen, fraction) {
  const contentH = screen.h - screen.top;
  return screen.top + contentH * fraction;
}

async function countRows(supabase, shopUserId) {
  const { data: staff } = await supabase.from('staff').select('id,name').eq('user_id', shopUserId);
  const { data: cloths } = await supabase.from('cloths').select('id,code,customer_name').eq('user_id', shopUserId);
  return { staff: staff ?? [], cloths: cloths ?? [] };
}

async function waitForStaff(supabase, shopUserId, name, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.from('staff').select('id,name').eq('user_id', shopUserId).eq('name', name);
    if (data?.length) return data[0];
    await sleep(1500);
  }
  return null;
}

function tap(x, y) {
  adb('shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y)));
}

function typeText(text) {
  const escaped = text.replace(/ /g, '%s');
  adb('shell', 'input', 'text', escaped);
}

function launchApp() {
  adb('shell', 'am', 'force-stop', PKG);
  sleep(800);
  adb('shell', 'am', 'start', '-n', ACTIVITY);
}

function loginOnDevice(screen) {
  const { w } = screen;
  tap(w * 0.5, contentY(screen, 0.52));
  typeText(PASSWORD);
  tap(w * 0.5, contentY(screen, 0.68));
}

async function addStaffOnDevice(screen, staffName) {
  const { w } = screen;
  await sleep(3000);

  tap(w * 0.83, contentY(screen, 0.92));
  await sleep(2000);

  tap(w * 0.88, contentY(screen, 0.08));
  await sleep(1000);

  tap(w * 0.5, contentY(screen, 0.34));
  await sleep(300);
  typeText(staffName.replace(/[^a-zA-Z0-9]/g, ''));
  await sleep(400);

  tap(w * 0.5, contentY(screen, 0.64));
  await sleep(3000);
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const shopUserId = env.VITE_SHOP_USER_ID;

  if (!url || !anonKey || !shopUserId) {
    throw new Error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or VITE_SHOP_USER_ID in .env.local');
  }

  const supabase = createClient(url, anonKey);
  const device = getDevice();
  console.log(`Device: ${device}`);

  console.log('Installing APK...');
  const install = spawnSync('adb', ['-s', device, 'install', '-r', APK], { encoding: 'utf8' });
  if (install.status !== 0) {
    throw new Error(`Install failed: ${install.stderr || install.stdout}`);
  }
  console.log('Install: OK');

  const before = await countRows(supabase, shopUserId);
  console.log(`Supabase before — staff: ${before.staff.length}, cloths: ${before.cloths.length}`);

  const screen = getScreenSize();
  console.log(`Screen: ${screen.w}x${screen.h}`);

  console.log('Launching app + login...');
  launchApp();
  await sleep(2500);
  loginOnDevice(screen);
  await sleep(3500);

  const staffName = `Dev${String(Date.now()).slice(-8)}`;
  console.log(`Adding staff on device: ${staffName}`);
  await addStaffOnDevice(screen, staffName);

  const running = adb('shell', 'pidof', PKG);
  console.log(`App process: ${running || 'not running'}`);

  console.log('Polling Supabase for device-created staff...');
  const created = await waitForStaff(supabase, shopUserId, staffName);

  const after = await countRows(supabase, shopUserId);
  console.log(`Supabase after — staff: ${after.staff.length}, cloths: ${after.cloths.length}`);

  if (created) {
    console.log(`PASS: Staff "${staffName}" saved to Supabase (id: ${created.id})`);
    await supabase.from('staff').delete().eq('id', created.id);
    console.log('Cleaned up test staff row');
  } else {
    console.error(`FAIL: Staff "${staffName}" not found in Supabase after UI add`);
    console.log('Recent staff:', after.staff.map((s) => s.name).join(', '));
    process.exit(1);
  }

  console.log('\nPASS: Device install + login + cloud save verified.');
  console.log('Refresh admin panel to see live data.');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
