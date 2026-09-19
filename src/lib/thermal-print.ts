import { APP_NAME } from './app-config';
import { PRINT_BARCODE, renderBarcodeCanvas } from './barcode';
import {
  buildEscPosTicket,
  canvasToEscPosRaster,
  imageDataUrlToEscPosRaster,
  uint8ToBase64,
} from './escpos';
import { isElectron } from './platform';

export type ThermalPrintResult = {
  ok: boolean;
  message: string;
  printer?: string;
};

function desktopApi() {
  if (typeof window === 'undefined') return undefined;
  return window.tailorDesktop;
}

export function canPrintThermal() {
  return isElectron() && Boolean(desktopApi()?.printRaw);
}

export async function printThermalTicket(input: {
  title?: string;
  lines: string[];
  barcodeValue: string;
  footer?: string;
  headerImageUrl?: string;
}): Promise<ThermalPrintResult> {
  const api = desktopApi();
  if (!api?.printRaw) {
    return { ok: false, message: 'Thermal print is only available in the Windows app' };
  }

  const canvas = renderBarcodeCanvas(input.barcodeValue, {
    height: PRINT_BARCODE.height,
    moduleWidth: PRINT_BARCODE.moduleWidth,
    maxWidth: PRINT_BARCODE.maxWidth,
    displayValue: false,
  });
  const raster = canvasToEscPosRaster(canvas);
  let headerRaster: Uint8Array | undefined;
  if (input.headerImageUrl) {
    try {
      headerRaster = await imageDataUrlToEscPosRaster(input.headerImageUrl, 240);
    } catch {
      headerRaster = undefined;
    }
  }
  const payload = buildEscPosTicket({
    title: input.title ?? APP_NAME,
    lines: input.lines,
    barcodeValue: input.barcodeValue,
    raster,
    headerRaster,
    footer: input.footer,
  });

  return api.printRaw(uint8ToBase64(payload));
}
