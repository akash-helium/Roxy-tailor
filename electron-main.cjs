const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { loadEnvFiles, sendWhatsAppFromPayload } = require('./lib/whatsapp-cloud.cjs');
const ota = require('./lib/electron-ota.cjs');

const isDev = !app.isPackaged;
const devPort = process.env.DESKTOP_DEV_PORT || '5180';
const devUrl = process.env.VITE_DEV_SERVER_URL || `http://127.0.0.1:${devPort}`;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.tailor.app');
}

function resolveIndexHtml() {
  return ota.resolveIndexHtml();
}

function resolveWindowIcon() {
  const candidates = [
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'public', 'logo.png'),
    path.join(__dirname, 'dist', 'logo.png'),
    path.join(process.resourcesPath, 'icon.png'),
  ];
  return candidates.find((file) => fs.existsSync(file));
}

function isSafeExternalUrl(url) {
  return /^https:\/\//i.test(url);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Roxy Tailor',
    icon: resolveWindowIcon(),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return;
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:') || url.startsWith(devUrl)) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    dialog.showErrorBox(
      'Roxy Tailor failed to load',
      `${errorDescription} (${errorCode})\n${validatedURL}`,
    );
  });

  if (isDev) {
    void win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const indexPath = resolveIndexHtml();
  void win.loadFile(indexPath).catch((error) => {
    dialog.showErrorBox(
      'Roxy Tailor failed to start',
      `${error instanceof Error ? error.message : String(error)}\n\nExpected:\n${indexPath}`,
    );
  });
}

function scoreThermalPrinter(printer) {
  const n = `${printer.name || ''} ${printer.displayName || ''}`.toLowerCase();
  if (/tvs/.test(n) && /3200|lite|rp/.test(n)) return 100;
  if (/tvs/.test(n)) return 90;
  if (/rp\s*3200|rp3200|3200\s*lite/.test(n)) return 80;
  if (/thermal|receipt|pos/.test(n)) return 40;
  return 0;
}

function pickThermalPrinter(printers) {
  const ranked = [...printers].sort((a, b) => scoreThermalPrinter(b) - scoreThermalPrinter(a));
  const best = ranked[0];
  if (best && scoreThermalPrinter(best) > 0) return best;
  return printers.find((p) => p.isDefault) ?? printers[0] ?? null;
}

function printRawTcp(host, buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port: 9100 }, () => {
      socket.write(buffer, () => socket.end());
    });
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error('Thermal printer timed out on port 9100'));
    });
    socket.on('error', reject);
    socket.on('close', () => resolve());
  });
}

function printRawWindows(printerName, filePath) {
  const safePrinter = printerName.replace(/'/g, "''");
  const safeFile = filePath.replace(/'/g, "''");
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RoxyRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
"@
$printer = '${safePrinter}'
$path = '${safeFile}'
$bytes = [System.IO.File]::ReadAllBytes($path)
$h = [IntPtr]::Zero
if (-not [RoxyRawPrint]::OpenPrinter($printer, [ref]$h, [IntPtr]::Zero)) { throw "OpenPrinter failed: $printer" }
try {
  $di = New-Object RoxyRawPrint+DOCINFOA
  $di.pDocName = 'Roxy Tailor'
  $di.pDataType = 'RAW'
  if ([RoxyRawPrint]::StartDocPrinter($h, 1, $di) -eq 0) { throw 'StartDocPrinter failed' }
  try {
    [void][RoxyRawPrint]::StartPagePrinter($h)
    $ptr = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    try {
      [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
      $written = 0
      if (-not [RoxyRawPrint]::WritePrinter($h, $ptr, $bytes.Length, [ref]$written)) { throw 'WritePrinter failed' }
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($ptr) }
    [void][RoxyRawPrint]::EndPagePrinter($h)
  } finally { [void][RoxyRawPrint]::EndDocPrinter($h) }
} finally { [void][RoxyRawPrint]::ClosePrinter($h) }
`;

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `RAW print failed (${code})`));
    });
  });
}

ipcMain.handle('list-printers', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return [];
  return win.webContents.getPrintersAsync();
});

ipcMain.handle('print-raw', async (event, base64) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, message: 'No window' };

  const buffer = Buffer.from(String(base64 || ''), 'base64');
  if (buffer.length < 8) {
    return { ok: false, message: 'Nothing to print' };
  }

  const printers = await win.webContents.getPrintersAsync();
  const printer = pickThermalPrinter(printers);
  if (!printer) {
    return { ok: false, message: 'TVS RP 3200 LITE not found. Connect the USB printer and try again.' };
  }

  const portName = printer.portName || printer.options?.portName || '';
  const ipMatch = String(portName).match(/(\d{1,3}(?:\.\d{1,3}){3})/);

  try {
    if (ipMatch) {
      await printRawTcp(ipMatch[1], buffer);
    } else if (process.platform === 'win32') {
      const filePath = path.join(os.tmpdir(), `roxy-tailor-${Date.now()}.prn`);
      fs.writeFileSync(filePath, buffer);
      try {
        await printRawWindows(printer.name, filePath);
      } finally {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    } else {
      return { ok: false, message: 'RAW thermal print is supported on Windows.' };
    }

    return { ok: true, message: `Printed on ${printer.name}`, printer: printer.name };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Thermal print failed',
      printer: printer.name,
    };
  }
});

function loadWhatsAppEnv() {
  loadEnvFiles([
    path.join(__dirname, '.env.local'),
    path.join(process.cwd(), '.env.local'),
    path.join(app.getPath('userData'), 'whatsapp.env'),
    path.join(path.dirname(process.execPath), 'whatsapp.env'),
  ]);
}

ipcMain.handle('open-external', async (_event, url) => {
  const href = String(url || '');
  if (!/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href)) {
    return { ok: false, message: 'Blocked URL' };
  }
  await shell.openExternal(href);
  return { ok: true };
});

ipcMain.handle('send-whatsapp', async (_event, payload) => {
  loadWhatsAppEnv();
  return sendWhatsAppFromPayload(payload);
});

ipcMain.handle('ota-status', () => ota.getStatus());
ipcMain.handle('ota-notify-ready', () => ota.getStatus());
ipcMain.handle('ota-relaunch', () => {
  ota.relaunch();
});

app.whenReady().then(() => {
  createWindow();
  void ota.checkForUpdate()
    .then((status) => {
      if (!status.ready) return;
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('ota-ready', { version: status.available, notes: status.notes });
      }
    })
    .catch((error) => {
      console.error('OTA check failed', error);
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
