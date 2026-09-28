const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { app } = require('electron');

function parseVersion(value) {
  return String(value)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(next, current) {
  const a = parseVersion(next);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
}

function otaRoot() {
  return path.join(app.getPath('userData'), 'ota');
}

function currentDir() {
  return path.join(otaRoot(), 'current');
}

function pendingDir() {
  return path.join(otaRoot(), 'pending');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function builtinMeta() {
  const pkg = readJson(path.join(app.getAppPath(), 'package.json')) ?? { version: '0.0.0' };
  const ota = readJson(path.join(app.getAppPath(), 'dist', 'ota.json')) ?? {};
  return {
    version: String(pkg.version || '0.0.0'),
    manifestUrl: String(ota.manifestUrl || ''),
  };
}

function installedOtaVersion() {
  const meta = readJson(path.join(currentDir(), 'ota.json'));
  if (meta?.version) return String(meta.version);
  return null;
}

function currentVersion() {
  return installedOtaVersion() || builtinMeta().version;
}

function promotePending() {
  if (!fs.existsSync(path.join(pendingDir(), 'index.html'))) return;
  const backup = path.join(otaRoot(), 'previous');
  rmDir(backup);
  try {
    if (fs.existsSync(currentDir())) {
      fs.renameSync(currentDir(), backup);
    }
    fs.renameSync(pendingDir(), currentDir());
    if (!fs.existsSync(path.join(currentDir(), 'index.html')) && fs.existsSync(path.join(backup, 'index.html'))) {
      rmDir(currentDir());
      fs.renameSync(backup, currentDir());
    }
  } catch {
    if (fs.existsSync(backup) && !fs.existsSync(path.join(currentDir(), 'index.html'))) {
      fs.renameSync(backup, currentDir());
    }
  }
}

function resolveIndexHtml() {
  promotePending();
  const otaIndex = path.join(currentDir(), 'index.html');
  if (fs.existsSync(otaIndex)) return otaIndex;
  return path.join(app.getAppPath(), 'dist', 'index.html');
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function extractZip(zipPath, dest) {
  rmDir(dest);
  fs.mkdirSync(dest, { recursive: true });
  return new Promise((resolve, reject) => {
    const child =
      process.platform === 'win32'
        ? spawn(
            'powershell.exe',
            [
              '-NoProfile',
              '-ExecutionPolicy',
              'Bypass',
              '-Command',
              `Expand-Archive -Force -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}'`,
            ],
            { windowsHide: true },
          )
        : spawn('unzip', ['-o', zipPath, '-d', dest]);
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Unzip failed (${code})`));
    });
  });
}

function flattenExtracted(dest) {
  if (fs.existsSync(path.join(dest, 'index.html'))) return;
  const entries = fs.readdirSync(dest, { withFileTypes: true });
  const onlyDir = entries.length === 1 && entries[0]?.isDirectory() ? path.join(dest, entries[0].name) : null;
  if (onlyDir && fs.existsSync(path.join(onlyDir, 'index.html'))) {
    for (const name of fs.readdirSync(onlyDir)) {
      fs.renameSync(path.join(onlyDir, name), path.join(dest, name));
    }
    fs.rmSync(onlyDir, { recursive: true, force: true });
  }
}

async function downloadFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

let lastStatus = {
  current: '0.0.0',
  available: null,
  ready: false,
  notes: undefined,
};

function getStatus() {
  lastStatus.current = currentVersion();
  return lastStatus;
}

async function checkForUpdate() {
  const builtin = builtinMeta();
  lastStatus.current = currentVersion();
  if (!builtin.manifestUrl) return lastStatus;

  const response = await fetch(`${builtin.manifestUrl}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return lastStatus;
  const manifest = await response.json();
  const version = String(manifest.version || '');
  const url = String(manifest.url || '');
  if (!version || !url) return lastStatus;

  const minNative = manifest.minNativeVersion ? String(manifest.minNativeVersion) : '';
  if (minNative && isNewerVersion(minNative, builtin.version)) return lastStatus;
  if (!isNewerVersion(version, lastStatus.current)) return lastStatus;

  const zipPath = path.join(otaRoot(), `bundle-${version}.zip`);
  const checksum = await downloadFile(url, zipPath);
  if (manifest.checksum && String(manifest.checksum).toLowerCase() !== checksum.toLowerCase()) {
    throw new Error('OTA checksum mismatch');
  }
  await extractZip(zipPath, pendingDir());
  flattenExtracted(pendingDir());
  if (!fs.existsSync(path.join(pendingDir(), 'index.html'))) {
    throw new Error('OTA bundle is missing index.html');
  }
  fs.writeFileSync(
    path.join(pendingDir(), 'ota.json'),
    JSON.stringify({ version, manifestUrl: builtin.manifestUrl }, null, 2),
  );
  try {
    fs.unlinkSync(zipPath);
  } catch {
    // ignore
  }

  lastStatus = {
    current: lastStatus.current,
    available: version,
    ready: true,
    notes: manifest.notes ? String(manifest.notes) : undefined,
  };
  return lastStatus;
}

function relaunch() {
  app.relaunch();
  app.exit(0);
}

module.exports = {
  resolveIndexHtml,
  getStatus,
  checkForUpdate,
  relaunch,
  currentVersion,
};
