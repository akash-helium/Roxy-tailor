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
  margin?: number;
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
  const margin = options.margin ?? Math.max(moduleWidth * 10, 24);

  const canvas = document.createElement('canvas');

  const draw = (width: number) => {
    JsBarcode(canvas, value, {
      format: PRINT_FORMAT,
      width,
      height,
      margin,
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

/** Date left, barcode center, order number right — one thermal raster row. */
export function renderStaffHeaderBannerCanvas(
  dateLabel: string,
  orderNumber: string,
  barcodeValue: string,
) {
  const width = THERMAL_PRINTER.printableDots;
  const side = 176;
  const barcode = renderBarcodeCanvas(barcodeValue, {
    height: 68,
    moduleWidth: 2,
    maxWidth: Math.max(140, width - side * 2 - 4),
    displayValue: false,
    margin: 4,
  });
  const height = Math.max(88, barcode.height + 18);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.font = '500 14px sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('Delivery Date', 2, 2, side - 6);
  ctx.textAlign = 'right';
  ctx.fillText('Order No', width - 2, 2, side - 6);
  ctx.font = '700 30px sans-serif';

  const wrap = (text: string, maxWidth: number) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3);
  };

  const drawSide = (text: string, x: number, align: CanvasTextAlign) => {
    const lines = wrap(text || '—', side - 6);
    const lineHeight = 32;
    const startY = 20;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    lines.forEach((line, index) => {
      ctx.fillText(line, x, startY + index * lineHeight, side - 6);
    });
  };

  drawSide(dateLabel, 2, 'left');
  ctx.drawImage(barcode, Math.round((width - barcode.width) / 2), 14);
  ctx.font = '700 30px ui-monospace, monospace';
  drawSide(orderNumber, width - 2, 'right');
  return canvas;
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
      : compact.startsWith('OR') && compact.length > 2 && !normalized.includes('-')
        ? `OR-${compact.slice(2)}`
        : normalized;
  return [...new Set([normalized, compact, hyphenated].filter(Boolean))];
}
