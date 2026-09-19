import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = resolve(root, 'release');
const pkg = await import(resolve(root, 'package.json'), { with: { type: 'json' } }).then(
  (m) => m.default,
);
const version = pkg.version;

mkdirSync(releaseDir, { recursive: true });

const files = readdirSync(releaseDir);

function copySource(sourceName, targetName) {
  if (!files.includes(sourceName)) return false;
  copyFileSync(resolve(releaseDir, sourceName), resolve(releaseDir, targetName));
  console.log(`Copied ${sourceName} -> ${targetName}`);
  return true;
}

const copied = [
  copySource(`Roxy Tailor Setup ${version}.exe`, `roxy-tailor-v${version}-setup.exe`),
  copySource(`Roxy-Tailor-Portable-${version}.exe`, `roxy-tailor-v${version}-portable.exe`),
  copySource(`Roxy Tailor-${version}-win.zip`, `roxy-tailor-v${version}-win-x64.zip`),
  copySource(`Roxy Tailor-${version}-arm64-win.zip`, `roxy-tailor-v${version}-win-arm64.zip`),
].some(Boolean);

if (!copied) {
  console.warn(`No Windows build artifacts for version ${version} found in release/`);
  process.exit(1);
}

console.log('\nWindows builds ready:');
console.log(`  Universal installer (auto-picks CPU) -> roxy-tailor-v${version}-setup.exe`);
console.log(`  Portable (no install)                -> roxy-tailor-v${version}-portable.exe`);
console.log(`  Zip Intel/AMD                        -> roxy-tailor-v${version}-win-x64.zip`);
console.log(`  Zip ARM (Snapdragon)                 -> roxy-tailor-v${version}-win-arm64.zip`);
