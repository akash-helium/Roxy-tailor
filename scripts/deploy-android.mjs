import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = await import(resolve(root, 'package.json'), { with: { type: 'json' } }).then(
  (m) => m.default,
);
const apk = resolve(root, 'release', `roxy-tailor-v${pkg.version}.apk`);
const fallback = resolve(root, 'android/app/build/outputs/apk/release/app-release.apk');
const installApk = existsSync(apk) ? apk : fallback;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

run('bun run build:apk');

const devices = execSync('adb devices', { encoding: 'utf8' })
  .split('\n')
  .slice(1)
  .map((line) => line.trim().split('\t')[0])
  .filter((id) => id && id !== '');

if (devices.length === 0) {
  console.error('No Android device connected. Connect USB debugging and retry.');
  process.exit(1);
}

const device = devices[0];
console.log(`Using device: ${device}`);

try {
  run(`adb -s ${device} uninstall com.tailor.app`);
} catch {
  console.log('App was not installed (or uninstall failed); continuing with install.');
}

run(`adb -s ${device} install -r "${installApk}"`);
console.log(`Installed ${installApk}`);
