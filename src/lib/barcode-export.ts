import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Cloth } from '../types';

function dataUrlToBase64(dataUrl: string) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  if (!base64) throw new Error('Invalid barcode image data');
  return base64;
}

function safeFilename(code: string) {
  return code.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 48) || 'barcode';
}

function isShareDismissed(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss|abort|closed|user/i.test(message);
}

async function writeTextFile(path: string, data: string, directory: Directory) {
  return Filesystem.writeFile({
    path,
    data,
    directory,
    encoding: Encoding.UTF8,
    recursive: true,
  });
}

async function writeBase64File(path: string, base64: string, directory: Directory) {
  return Filesystem.writeFile({
    path,
    data: base64,
    directory,
    recursive: true,
  });
}

async function ensureStoragePermission() {
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') return true;
    const requested = await Filesystem.requestPermissions();
    return requested.publicStorage === 'granted';
  } catch {
    return false;
  }
}

export async function prepareBarcodeFile(dataUrl: string, code: string) {
  const filename = `TailorBarcode_${safeFilename(code)}.png`;
  const base64 = dataUrlToBase64(dataUrl);
  const cachePath = `tailor-barcode/${filename}`;

  await writeBase64File(cachePath, base64, Directory.Cache);

  try {
    await writeBase64File(`TailorBarcode/${filename}`, base64, Directory.Documents);
  } catch {
    // Documents may be restricted; Cache file is enough for share/print.
  }

  const { uri } = await Filesystem.getUri({
    path: cachePath,
    directory: Directory.Cache,
  });

  return { filename, fileUri: uri };
}

async function prepareHtmlFile(html: string, filename: string, folder: string) {
  const cachePath = `${folder}/${filename}`;
  await writeTextFile(cachePath, html, Directory.Cache);

  try {
    await writeTextFile(`${folder}-docs/${filename}`, html, Directory.Documents);
  } catch {
    // optional
  }

  const { uri } = await Filesystem.getUri({
    path: cachePath,
    directory: Directory.Cache,
  });

  return { filename, fileUri: uri };
}

async function trySaveToPublicDownloads(base64: string, filename: string) {
  const hasPermission = await ensureStoragePermission();
  if (!hasPermission) return false;

  try {
    await writeBase64File(`Download/${filename}`, base64, Directory.ExternalStorage);
    return true;
  } catch {
    try {
      await writeBase64File(filename, base64, Directory.Documents);
      return true;
    } catch {
      return false;
    }
  }
}

async function openShareSheet(
  fileUri: string,
  cloth: Cloth,
  dialogTitle: string,
  garmentLines?: string[],
) {
  const items =
    garmentLines && garmentLines.length > 0
      ? garmentLines.join(' · ')
      : cloth.garment;
  await Share.share({
    title: `Barcode ${cloth.code}`,
    text: `${cloth.code} · ${cloth.customerName} · ${items}`,
    files: [fileUri],
    dialogTitle,
  });
}

/** Native print/save of full barcode card (barcode image + order data as HTML). */
export async function exportBarcodeCardForNative(
  cardHtml: string,
  cloth: Cloth,
  action: 'print' | 'save' | 'share' = 'print',
  options?: { garmentLines?: string[] },
) {
  const filename = `TailorBarcodeCard_${safeFilename(cloth.code)}_${Date.now()}.html`;
  const { fileUri } = await prepareHtmlFile(cardHtml, filename, 'tailor-barcode');

  const titles = {
    print: 'Print barcode card — pick Print or Save as PDF',
    save: 'Save barcode card — pick Files or Downloads',
    share: 'Share barcode card',
  };

  try {
    await openShareSheet(fileUri, cloth, titles[action], options?.garmentLines);
  } catch (error) {
    if (!isShareDismissed(error)) throw error;
    return {
      ok: true as const,
      message: action === 'print' ? 'Print cancelled' : action === 'save' ? 'Save cancelled' : 'Share cancelled',
      fileUri,
    };
  }

  return {
    ok: true as const,
    message:
      action === 'print'
        ? 'Pick a print app from the menu'
        : action === 'save'
          ? 'Pick Files / Downloads to save the barcode card'
          : 'Shared',
    fileUri,
  };
}

export async function exportBarcodeForNative(
  dataUrl: string,
  cloth: Cloth,
  action: 'print' | 'save' | 'share',
  options?: { garmentLines?: string[]; cardHtml?: string },
) {
  // Prefer full barcode card (barcode + order data) for print/save/share.
  if (options?.cardHtml) {
    return exportBarcodeCardForNative(options.cardHtml, cloth, action, options);
  }

  const { filename, fileUri } = await prepareBarcodeFile(dataUrl, cloth.code);
  const base64 = dataUrlToBase64(dataUrl);

  if (action === 'save') {
    const savedPublic = await trySaveToPublicDownloads(base64, filename);

    try {
      await openShareSheet(fileUri, cloth, 'Save barcode — pick Files or Downloads', options?.garmentLines);
    } catch (error) {
      if (!isShareDismissed(error)) throw error;
    }

    if (savedPublic) {
      return {
        ok: true as const,
        message: `Saved to Downloads/${filename}`,
        fileUri,
      };
    }

    return {
      ok: true as const,
      message: `Saved in app (${filename}). Share menu opened — pick Save to Files if needed.`,
      fileUri,
    };
  }

  const titles = {
    print: 'Print barcode — pick Print or Save as PDF',
    share: 'Share barcode card',
    save: 'Save barcode to device',
  };

  try {
    await openShareSheet(fileUri, cloth, titles[action], options?.garmentLines);
  } catch (error) {
    if (!isShareDismissed(error)) throw error;
    return {
      ok: true as const,
      message: action === 'print' ? 'Print cancelled' : 'Share cancelled',
      fileUri,
    };
  }

  return {
    ok: true as const,
    message: action === 'print' ? 'Pick a print app from the menu' : 'Shared',
    fileUri,
  };
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}
