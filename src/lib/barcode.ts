import JsBarcode from 'jsbarcode';

export function normalizeClothCode(code: string) {
  return code.trim().toUpperCase();
}

/**
 * TVS RP 3200 LITE: 80mm paper, 203 DPI (~576 dots printable).
 * Fingers QuickScan WL2: 1D laser — needs thick black bars on paper, not screens.
 * CODE128 is the receipt standard: compact enough not to shrink on 80mm, still 1D.
 */
export const THERMAL_PRINTER = {
  model: 'TVS RP 3200 LITE',
  paperWidthMm: 80,
  dpi: 203,
  printableDots: 576,
} as const;

export const PRINT_FORMAT = 'CODE128' as const;

/** Compact ticket barcode: ~46mm × 11mm on 80mm paper, still readable by QuickScan WL2. */
export const PRINT_BARCODE = {
  height: 88,
  moduleWidth: 2,
  maxWidth: 360,
  cssWidth: '46mm',
  cssHeight: '11mm',
} as const;

export type BarcodeRenderOptions = {
  height?: number;
  moduleWidth?: number;
  displayValue?: boolean;
  /** Target canvas width in pixels (203 DPI thermal = 576). */
  maxWidth?: number;
};

function toBarcodeValue(text: string) {
  const normalized = normalizeClothCode(text).replace(/[^A-Z0-9\-]/g, '');
  return normalized || 'UNKNOWN';
}

function forceMono(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const on = data[i] < 160 || data[i + 1] < 160 || data[i + 2] < 160;
    const v = on ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function renderBarcodeCanvas(text: string, options: BarcodeRenderOptions = {}) {
  const value = toBarcodeValue(text);
  const height = options.height ?? PRINT_BARCODE.height;
  const displayValue = options.displayValue ?? false;
  const maxWidth = options.maxWidth ?? PRINT_BARCODE.maxWidth;
  let moduleWidth = options.moduleWidth ?? PRINT_BARCODE.moduleWidth;

  const canvas = document.createElement('canvas');

  const draw = (width: number) => {
    JsBarcode(canvas, value, {
      format: PRINT_FORMAT,
      width,
      height,
      margin: Math.max(width * 10, 24),
      displayValue,
      fontSize: 18,
      fontOptions: 'bold',
      textMargin: 6,
      lineColor: '#000000',
      background: '#ffffff',
    });
  };

  draw(moduleWidth);
  while (canvas.width > maxWidth && moduleWidth > 2) {
    moduleWidth -= 1;
    draw(moduleWidth);
  }

  forceMono(canvas);
  return canvas;
}

/** Laser-optimised 1-bit CODE128 PNG for TVS 203 DPI / QuickScan WL2. */
export async function generateBarcodeDataUrl(
  text: string,
  heightOrOptions: number | BarcodeRenderOptions = PRINT_BARCODE.height,
  moduleWidthArg = PRINT_BARCODE.moduleWidth,
) {
  const options: BarcodeRenderOptions =
    typeof heightOrOptions === 'number'
      ? { height: heightOrOptions, moduleWidth: moduleWidthArg, displayValue: false }
      : heightOrOptions;

  const canvas = renderBarcodeCanvas(text, {
    height: options.height ?? PRINT_BARCODE.height,
    moduleWidth: options.moduleWidth ?? PRINT_BARCODE.moduleWidth,
    displayValue: options.displayValue ?? false,
    maxWidth: options.maxWidth ?? PRINT_BARCODE.maxWidth,
  });

  return canvas.toDataURL('image/png');
}

/** Larger on-screen preview (laser cannot read LCD — print the ticket). */
export async function generateOnScreenBarcodeDataUrl(text: string) {
  return generateBarcodeDataUrl(text, {
    height: PRINT_BARCODE.height,
    moduleWidth: PRINT_BARCODE.moduleWidth,
    maxWidth: PRINT_BARCODE.maxWidth,
    displayValue: false,
  });
}

/** Lookup variants: CL-001, CL001, scanner may drop the hyphen. */
export function barcodeLookupCandidates(code: string) {
  const normalized = normalizeClothCode(code).replace(/[^A-Z0-9\-]/g, '');
  const compact = normalized.replace(/-/g, '');
  const hyphenated =
    compact.startsWith('CL') && compact.length > 2 && !normalized.includes('-')
      ? `CL-${compact.slice(2)}`
      : normalized;
  return [...new Set([normalized, compact, hyphenated].filter(Boolean))];
}
