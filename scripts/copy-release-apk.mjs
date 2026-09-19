import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isDebug = process.argv.includes('--debug');
const pkg = await import(resolve(root, 'package.json'), { with: { type: 'json' } }).then(
  (m) => m.default,
);
const version = pkg.version;
const source = resolve(
  root,
  isDebug
    ? 'android/app/build/outputs/apk/debug/app-debug.apk'
    : 'android/app/build/outputs/apk/release/app-release.apk',
);
const target = resolve(
  root,
  'release',
  isDebug ? `roxy-tailor-v${version}-debug.apk` : `roxy-tailor-v${version}.apk`,
);

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied APK to ${target}`);
