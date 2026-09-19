import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40) || 'customer';
}

function isShareDismissed(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss|abort|closed|user/i.test(message);
}

export function printBillHtml(html: string, _title?: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };

  // Wait for barcode images to load before printing (Windows + Android WebView).
  const images = Array.from(doc.images);
  if (images.length === 0) {
    triggerPrint();
  } else {
    let remaining = images.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) triggerPrint();
    };
    for (const img of images) {
      if (img.complete) done();
      else {
        img.addEventListener('load', done);
        img.addEventListener('error', done);
      }
    }
    setTimeout(triggerPrint, 1500);
  }

  setTimeout(() => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, 4000);
  return true;
}

async function prepareBillFile(html: string, customerName: string) {
  const filename = `TailorBill_${safeFilename(customerName)}_${Date.now()}.html`;
  const cachePath = `tailor-bills/${filename}`;

  await Filesystem.writeFile({
    path: cachePath,
    data: html,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  try {
    await Filesystem.writeFile({
      path: `TailorBills/${filename}`,
      data: html,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch {
    // Documents optional
  }

  const { uri } = await Filesystem.getUri({
    path: cachePath,
    directory: Directory.Cache,
  });

  return { filename, fileUri: uri };
}

export async function exportBillForNative(
  html: string,
  customerName: string,
  action: 'print' | 'share' | 'save',
) {
  const { fileUri, filename } = await prepareBillFile(html, customerName);

  const titles = {
    print: 'Print bill — pick Print or Save as PDF',
    share: 'Share customer bill',
    save: 'Save bill — pick Files or Downloads',
  };

  try {
    await Share.share({
      title: `Bill · ${customerName}`,
      text: `Customer bill for ${customerName}`,
      files: [fileUri],
      dialogTitle: titles[action],
    });
  } catch (error) {
    if (!isShareDismissed(error)) throw error;
    return {
      ok: true as const,
      message:
        action === 'print' ? 'Print cancelled' : action === 'save' ? 'Save cancelled' : 'Share cancelled',
      filename,
    };
  }

  return {
    ok: true as const,
    message:
      action === 'print'
        ? 'Pick a print app from the menu'
        : action === 'save'
          ? 'Pick Files / Downloads to save the bill'
          : 'Bill shared',
    filename,
  };
}

export function downloadBillHtml(html: string, customerName: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bill-${safeFilename(customerName)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}
