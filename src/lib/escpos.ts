const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function concat(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytes(...values: number[]) {
  return Uint8Array.from(values);
}

/** ESC/POS printers on this shop floor speak CP437/ASCII. */
export function toEscPosAscii(value: string) {
  return value
    .replace(/₹/g, 'Rs ')
    .replace(/[—–−]/g, '-')
    .replace(/[·•]/g, ',')
    .replace(/[✓✔☑√]/g, 'v')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wrapEscPosLine(value: string, width = 42) {
  const ascii = toEscPosAscii(value);
  if (!ascii) return [''];

  const words = ascii.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function escPosText(value: string) {
  const chars: number[] = [];
  for (const char of toEscPosAscii(value)) {
    const code = char.charCodeAt(0);
    chars.push(code >= 32 && code <= 126 ? code : 63);
  }
  return Uint8Array.from(chars);
}

/** 1-bit canvas → GS v 0 raster (exact 203 DPI bars, no GDI dithering). */
export function canvasToEscPosRaster(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8Array();

  const width = canvas.width;
  const height = canvas.height;
  const widthBytes = Math.ceil(width / 8);
  const img = ctx.getImageData(0, 0, width, height);
  const raster = new Uint8Array(widthBytes * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      const a = img.data[i + 3];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const dark = a > 80 && (lum < 210 || r < 250 || g < 230 || b < 230);
      if (dark) {
        raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return concat(
    bytes(GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff),
    raster,
  );
}

export async function imageDataUrlToEscPosRaster(dataUrl: string, maxWidth = 240) {
  if (!dataUrl) return new Uint8Array();
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  if (!sourceWidth || !sourceHeight) return new Uint8Array();
  const width = Math.min(maxWidth, sourceWidth);
  const height = Math.max(1, Math.round((sourceHeight * width) / sourceWidth));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8Array();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvasToEscPosRaster(canvas);
}

/** Drawn checkmark + label so the printer never falls back to an ASCII "x". */
export function tickedLabelRaster(label: string, width = 576) {
  const height = 40;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8Array();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#000000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(8, 22);
  ctx.lineTo(18, 32);
  ctx.lineTo(38, 8);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = '700 22px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 50, height / 2 + 1);
  return canvasToEscPosRaster(canvas);
}

export type EscPosTicket = {
  title: string;
  headerLines?: string[];
  lines: string[];
  barcodeValue: string;
  raster: Uint8Array;
  headerRaster?: Uint8Array;
  footer?: string;
  /** Staff tickets: scan code after the date/order header. Customer bills: after totals. */
  barcodePlacement?: 'middle' | 'end';
};

export function buildEscPosTicket(ticket: EscPosTicket) {
  const chunks: Uint8Array[] = [
    bytes(ESC, 0x40),
    bytes(ESC, 0x45, 1),
    bytes(ESC, 0x61, 1),
  ];

  if (ticket.headerRaster && ticket.headerRaster.length > 8) {
    chunks.push(ticket.headerRaster, bytes(LF));
  } else {
    chunks.push(bytes(GS, 0x21, 0x11), escPosText(ticket.title), bytes(LF), bytes(GS, 0x21, 0x00));
  }

  chunks.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x61, 0));

  const pushLines = (lines: string[]) => {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        chunks.push(bytes(LF));
        continue;
      }
      if (trimmed.startsWith('!!PENDING ')) {
        const amount = trimmed.slice('!!PENDING '.length);
        chunks.push(bytes(GS, 0x21, 0x11), bytes(ESC, 0x45, 1));
        chunks.push(escPosText(`Pending  ${amount}`), bytes(LF));
        chunks.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, 1));
        continue;
      }
      if (trimmed.startsWith('!!ITEM ')) {
        const item = trimmed.slice('!!ITEM '.length);
        chunks.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, 1));
        chunks.push(escPosText(item), bytes(LF));
        continue;
      }
      if (/^[✓✔☑√]/.test(trimmed)) {
        chunks.push(tickedLabelRaster(trimmed.replace(/^[✓✔☑√]\s*/, '')), bytes(LF));
        continue;
      }
      for (const wrapped of wrapEscPosLine(trimmed)) {
        chunks.push(escPosText(wrapped), bytes(LF));
      }
    }
  };

  const pushBarcode = () => {
    chunks.push(bytes(LF), bytes(ESC, 0x61, 1), ticket.raster, bytes(LF));
    chunks.push(bytes(GS, 0x21, 0x11), escPosText(ticket.barcodeValue), bytes(LF), bytes(GS, 0x21, 0x00));
    chunks.push(bytes(ESC, 0x61, 0));
  };

  pushLines(ticket.headerLines ?? []);
  if ((ticket.barcodePlacement ?? 'end') === 'middle') pushBarcode();
  pushLines(ticket.lines);

  if (ticket.footer) {
    chunks.push(bytes(LF), bytes(ESC, 0x61, 1));
    for (const line of wrapEscPosLine(ticket.footer, 42)) {
      chunks.push(escPosText(line), bytes(LF));
    }
    chunks.push(bytes(ESC, 0x61, 0));
  }

  if ((ticket.barcodePlacement ?? 'end') === 'end') pushBarcode();

  chunks.push(bytes(LF, LF), bytes(GS, 0x56, 0x41, 0x18));
  return concat(...chunks);
}

export function uint8ToBase64(bytesIn: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytesIn.length; i += chunk) {
    binary += String.fromCharCode(...bytesIn.subarray(i, i + chunk));
  }
  return btoa(binary);
}
