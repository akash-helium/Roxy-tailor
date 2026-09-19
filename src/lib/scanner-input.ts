import { normalizeClothCode } from './barcode';

/**
 * QuickScan WL2 (FINGERS) — 1D laser, 2.4 GHz HID keyboard wedge.
 * Printed tickets use CODE128 sized for TVS RP 3200 LITE (80mm / 203 DPI).
 */
export const SUPPORTED_SCANNER = {
  model: 'QuickScan WL2',
  type: '1D Wireless Laser',
  link: '2.4 GHz USB dongle (HID keyboard)',
} as const;

export const SUPPORTED_PRINTER = {
  model: 'TVS RP 3200 LITE',
  paper: '80mm thermal',
  dpi: 203,
} as const;

/** Strip HID control chars, AIM IDs, and CODE39 start/stop asterisks. */
export function normalizeScannerBarcode(raw: string) {
  let code = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (code.startsWith(']') && code.length > 3) {
    code = code.slice(3);
  }
  code = code.replace(/^\*+|\*+$/g, '').trim();
  return normalizeClothCode(code);
}

export function isScanTerminatorKey(key: string) {
  return (
    key === 'Enter' ||
    key === 'NumpadEnter' ||
    key === 'Tab' ||
    key === 'Return'
  );
}

export function looksLikeScanPayload(value: string) {
  const normalized = normalizeScannerBarcode(value);
  if (normalized.length < 3) return false;
  if (/^CL-?[A-Z0-9-]{2,}$/i.test(normalized)) return true;
  if (/^[A-Z]{1,4}\d{4,}$/i.test(normalized)) return true;
  if (/^[A-Z0-9-]{6,32}$/i.test(normalized)) return true;
  return false;
}

/** WL2 2.4 GHz can gap keystrokes; keep this shorter than human typing pauses. */
export const SCANNER_BUFFER_MS = 450;

export const SCAN_CHAR_GAP_MS = 160;
