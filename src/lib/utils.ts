import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return crypto.randomUUID();
}

export function generateClothCode(existingCodes: string[]) {
  const numbers = existingCodes
    .map((code) => Number.parseInt(code.replace(/\D/g, ''), 10))
    .filter((value) => !Number.isNaN(value));

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `CL-${String(next).padStart(3, '0')}`;
}

export function nextClothCodes(existingCodes: string[], count: number) {
  const used = [...existingCodes];
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const code = generateClothCode(used);
    codes.push(code);
    used.push(code);
  }
  return codes;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCalendarDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function isPastDue(expectedDate: string | null, completed: boolean) {
  if (!expectedDate || completed) return false;
  return expectedDate < todayDateString();
}

import { garmentDisplayLabel } from './garments';
import { clothSizeSummary } from './measurements';

export function clothDescription(cloth: {
  garment: string;
  garmentType?: string;
  fabricColor: string;
  size: string;
  measurements?: Record<string, string>;
}) {
  const garmentLabel = garmentDisplayLabel(cloth.garmentType ?? null, cloth.garment);
  const parts = [garmentLabel];
  if (cloth.fabricColor?.trim()) parts.push(cloth.fabricColor.trim());
  const sizeSummary = clothSizeSummary({
    garmentType: cloth.garmentType ?? '',
    measurements: cloth.measurements ?? {},
    size: cloth.size,
  });
  if (sizeSummary) parts.push(sizeSummary);
  return parts.join(' · ');
}

/** Garment name only — for customer bills (no size or fabric). */
export function clothBillName(cloth: { garment: string; garmentType?: string }) {
  return garmentDisplayLabel(cloth.garmentType ?? null, cloth.garment);
}

export const IN_GROUP_TICKET_LABEL = 'Image in Whatsapp Group';
export const IN_GROUP_TICKET_LINE = `✓ ${IN_GROUP_TICKET_LABEL}`;

/** Garment name with measurements — for staff barcode labels. */
export function clothBarcodeLabel(cloth: {
  garment: string;
  garmentType?: string;
  size: string;
  measurements?: Record<string, string>;
  inGroup?: boolean;
}) {
  const { title, size } = staffClothParts(cloth);
  return size ? `${title} — ${size}` : title;
}

/** Name, sizes, and flags as separate lines for staff tickets. */
export function staffClothParts(
  cloth: {
    garment: string;
    garmentType?: string;
    size: string;
    measurements?: Record<string, string>;
    inGroup?: boolean;
  },
  index?: number,
) {
  const name = clothBillName(cloth);
  const title = index === undefined ? name : `${index + 1}. ${name}`;
  const size = clothSizeSummary({
    garmentType: cloth.garmentType ?? '',
    measurements: cloth.measurements ?? {},
    size: cloth.size,
  });
  return {
    title,
    size,
    inGroup: Boolean(cloth.inGroup),
  };
}

export function staffClothTicketLines(
  cloth: {
    garment: string;
    garmentType?: string;
    size: string;
    measurements?: Record<string, string>;
    inGroup?: boolean;
  },
  index: number,
) {
  const { title, size } = staffClothParts(cloth, index);
  const lines = [title];
  if (size) lines.push(size);
  return lines;
}
