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

function escPosExact(value: string) {
  const chars: number[] = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    chars.push(code >= 32 && code <= 126 ? code : 63);
  }
  return Uint8Array.from(chars);
}

function padEscPosSides(left: string, right: string, width = 42) {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
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
  afterBarcodeLines?: string[];
  /** Staff tickets: scan code after the date/order header. Customer bills: after totals. */
  barcodePlacement?: 'middle' | 'end';
  bold?: boolean;
};

export function buildEscPosTicket(ticket: EscPosTicket) {
  const boldOn = ticket.bold !== false;
  const chunks: Uint8Array[] = [
    bytes(ESC, 0x40),
    bytes(ESC, 0x45, boldOn ? 1 : 0),
    bytes(ESC, 0x61, 1),
  ];

  if ((ticket.barcodePlacement ?? 'end') === 'middle') {
    chunks.push(bytes(ESC, 0x33, 0), bytes(ESC, 0x65, 4));
  }

  if (ticket.headerRaster && ticket.headerRaster.length > 8) {
    chunks.push(ticket.headerRaster, bytes(LF));
  } else if (ticket.title.trim()) {
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
      if (trimmed.startsWith('!!SIDES ')) {
        const payload = trimmed.slice('!!SIDES '.length);
        const tab = payload.indexOf('\t');
        const left = toEscPosAscii(tab >= 0 ? payload.slice(0, tab) : payload);
        const right = toEscPosAscii(tab >= 0 ? payload.slice(tab + 1) : '');
        chunks.push(bytes(ESC, 0x61, 0), escPosExact(padEscPosSides(left, right)), bytes(LF));
        continue;
      }
      if (trimmed.startsWith('!!PENDING ')) {
        const payload = trimmed.slice('!!PENDING '.length);
        chunks.push(bytes(GS, 0x21, 0x11), bytes(ESC, 0x45, 1));
        for (const wrapped of wrapEscPosLine(payload, 21)) {
          chunks.push(escPosText(wrapped), bytes(LF));
        }
        chunks.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, boldOn ? 1 : 0));
        continue;
      }
      if (trimmed.startsWith('!!BIGSIDES ')) {
        const payload = trimmed.slice('!!BIGSIDES '.length);
        const tab = payload.indexOf('\t');
        const left = toEscPosAscii(tab >= 0 ? payload.slice(0, tab) : payload);
        const right = toEscPosAscii(tab >= 0 ? payload.slice(tab + 1) : '');
        chunks.push(bytes(GS, 0x21, 0x11), bytes(ESC, 0x45, 1), bytes(ESC, 0x61, 0));
        chunks.push(escPosExact(padEscPosSides(left.slice(0, 20), right.slice(0, 20), 21)), bytes(LF));
        chunks.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, boldOn ? 1 : 0));
        continue;
      }
      if (trimmed.startsWith('!!BIG ')) {
        const payload = trimmed.slice('!!BIG '.length);
        chunks.push(bytes(GS, 0x21, 0x11), bytes(ESC, 0x45, 1), bytes(ESC, 0x61, 0));
        for (const wrapped of wrapEscPosLine(payload, 21)) {
          chunks.push(escPosText(wrapped), bytes(LF));
        }
        chunks.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, boldOn ? 1 : 0));
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
    chunks.push(bytes(ESC, 0x61, 1), ticket.raster, bytes(LF));
    chunks.push(bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, boldOn ? 1 : 0), escPosText(ticket.barcodeValue), bytes(LF));
    chunks.push(bytes(ESC, 0x61, 0));
  };

  pushLines(ticket.headerLines ?? []);
  if ((ticket.barcodePlacement ?? 'end') === 'middle') pushBarcode();
  pushLines(ticket.lines);

  if ((ticket.barcodePlacement ?? 'end') === 'end') pushBarcode();

  const afterLines = ticket.afterBarcodeLines ?? [];
  if (afterLines.length > 0) {
    chunks.push(bytes(ESC, 0x61, 0), bytes(GS, 0x21, 0x00), bytes(ESC, 0x45, boldOn ? 1 : 0));
    for (const line of afterLines) {
      for (const wrapped of wrapEscPosLine(line, 42)) {
        chunks.push(escPosText(wrapped), bytes(LF));
      }
    }
  }

  if (ticket.footer) {
    chunks.push(bytes(LF), bytes(ESC, 0x61, 1));
    for (const line of wrapEscPosLine(ticket.footer, 42)) {
      chunks.push(escPosText(line), bytes(LF));
    }
    chunks.push(bytes(ESC, 0x61, 0));
  }

  chunks.push(bytes(LF, LF, LF, LF, LF), bytes(GS, 0x56, 0x41, 0x40));
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
