/**
 * Build a web bundle and upload it to the free Supabase Storage bucket `app-ota`.
 *
 * One-time: run supabase/app-ota-storage.sql in the Supabase SQL editor.
 * Then: bun run publish:ota
 *
 * Devices with an updater-enabled EXE/APK pick this up on next launch.
 * Native changes (new Capacitor plugins, electron-main.cjs) still need a new EXE/APK.
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DIST = resolve(ROOT, 'dist');
const OTA_DIR = resolve(ROOT, '.ota');
const BUCKET = 'app-ota';

function loadEnv() {
  try {
    const contents = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // vars may already be in the environment
  }
}

function zipDist(outFile) {
  rmSync(outFile, { force: true });
  if (process.platform === 'win32') {
    execSync(
      `powershell.exe -NoProfile -Command "Compress-Archive -Force -Path '${DIST.replace(/'/g, "''")}\\*' -DestinationPath '${outFile.replace(/'/g, "''")}'"`,
      { stdio: 'inherit' },
    );
    return;
  }
  execSync(`zip -r ${JSON.stringify(outFile)} .`, { cwd: DIST, stdio: 'inherit' });
}

loadEnv();

const url =
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const pkgPath = resolve(ROOT, 'package.json');
const pkgText = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgText);
let version = process.env.OTA_VERSION;
if (!version) {
  const parts = String(pkg.version)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  version = parts.join('.');
  writeFileSync(pkgPath, pkgText.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`));
}

console.log(`Building web bundle ${version}…`);
execSync('bun run build', { cwd: ROOT, stdio: 'inherit', env: process.env });

mkdirSync(OTA_DIR, { recursive: true });
const zipName = `roxy-tailor-${version}.zip`;
const zipPath = resolve(OTA_DIR, zipName);
zipDist(zipPath);

const zipBytes = readFileSync(zipPath);
const checksum = createHash('sha256').update(zipBytes).digest('hex');
const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const publicBase = `${url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}`;
const objectPath = `bundles/${zipName}`;
const manifest = {
  version,
  url: `${publicBase}/${objectPath}`,
  checksum,
  notes: process.env.OTA_NOTES || '',
  publishedAt: new Date().toISOString(),
};
if (process.env.OTA_MIN_NATIVE) {
  manifest.minNativeVersion = process.env.OTA_MIN_NATIVE;
}

writeFileSync(resolve(OTA_DIR, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Uploading ${zipName}…`);
const { error: zipError } = await supabase.storage.from(BUCKET).upload(objectPath, zipBytes, {
  contentType: 'application/zip',
  upsert: true,
});
if (zipError) {
  console.error(zipError.message);
  console.error('If the bucket is missing, run supabase/app-ota-storage.sql in the SQL editor.');
  process.exit(1);
}

const { error: manifestError } = await supabase.storage
  .from(BUCKET)
  .upload('latest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '0',
  });
if (manifestError) {
  console.error(manifestError.message);
  process.exit(1);
}

console.log('OTA published.');
console.log(`  version:  ${version}`);
console.log(`  manifest: ${publicBase}/latest.json`);
console.log('Windows EXE and Android APK that already include the updater will fetch this on next launch.');
console.log('Ship a new EXE/APK only when native code changes (plugins, printers, Electron main).');
