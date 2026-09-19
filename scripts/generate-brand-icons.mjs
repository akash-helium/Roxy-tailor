import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = '/Users/sky/.cursor/projects/Users-sky-Desktop-tailor-app/assets/ChatGPT_Image_Sep_19__2026__01_54_54_PM-e5b2faf2-ca10-4608-bb88-2bb34d64ba57.png';
const publicDir = resolve(root, 'public');
const buildDir = resolve(root, 'build');
const tmpDir = resolve(root, 'build', 'icon-tmp');

mkdirSync(publicDir, { recursive: true });
mkdirSync(buildDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const logoPng = resolve(publicDir, 'logo.png');
copyFileSync(source, logoPng);
copyFileSync(source, resolve(buildDir, 'icon.png'));

function resize(input, output, size) {
  const result = spawnSync(
    'sips',
    ['-s', 'format', 'png', '-z', String(size), String(size), input, '--out', output],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `sips failed for ${output}`);
  }
}

const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
const sizedFiles = sizes.map((size) => {
  const file = resolve(tmpDir, `${size}.png`);
  resize(logoPng, file, size);
  return file;
});

resize(logoPng, resolve(publicDir, 'favicon-32.png'), 32);
resize(logoPng, resolve(publicDir, 'apple-touch-icon.png'), 180);
resize(logoPng, resolve(buildDir, 'icon-256.png'), 256);
resize(logoPng, resolve(buildDir, 'icon-512.png'), 512);

const ico = await pngToIco([
  resolve(tmpDir, '16.png'),
  resolve(tmpDir, '24.png'),
  resolve(tmpDir, '32.png'),
  resolve(tmpDir, '48.png'),
  resolve(tmpDir, '64.png'),
  resolve(tmpDir, '128.png'),
  resolve(tmpDir, '256.png'),
]);
writeFileSync(resolve(buildDir, 'icon.ico'), ico);
writeFileSync(resolve(publicDir, 'favicon.ico'), ico);

const android = [
  ['mipmap-mdpi', 48, 108],
  ['mipmap-hdpi', 72, 162],
  ['mipmap-xhdpi', 96, 216],
  ['mipmap-xxhdpi', 144, 324],
  ['mipmap-xxxhdpi', 192, 432],
];

for (const [folder, launcher, foreground] of android) {
  const dir = resolve(root, 'android/app/src/main/res', folder);
  mkdirSync(dir, { recursive: true });
  resize(logoPng, resolve(dir, 'ic_launcher.png'), launcher);
  resize(logoPng, resolve(dir, 'ic_launcher_round.png'), launcher);
  resize(logoPng, resolve(dir, 'ic_launcher_foreground.png'), foreground);
}

console.log('Brand icons generated:');
console.log('  public/logo.png');
console.log('  public/favicon.ico');
console.log('  build/icon.ico');
console.log('  android mipmap launcher icons');
