import type { StaffPayout } from '../types';
import { generateId } from './utils';

const MARKER = '\n\n__STAFF_PAYOUTS__:';

export function parseStaffPayouts(value: unknown): StaffPayout[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as {
        id?: unknown;
        amount?: unknown;
        date?: unknown;
        note?: unknown;
        clothIds?: unknown;
        productLabel?: unknown;
        qty?: unknown;
        rate?: unknown;
      };
      const amount = Number(record.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const payout: StaffPayout = {
        id: typeof record.id === 'string' && record.id ? record.id : generateId(),
        amount,
        date: typeof record.date === 'string' ? record.date : '',
      };
      if (typeof record.note === 'string' && record.note.trim()) {
        payout.note = record.note.trim();
      }
      if (Array.isArray(record.clothIds)) {
        payout.clothIds = record.clothIds.filter((id): id is string => typeof id === 'string' && Boolean(id));
      }
      if (typeof record.productLabel === 'string' && record.productLabel.trim()) {
        payout.productLabel = record.productLabel.trim();
      }
      const qty = Number(record.qty);
      if (Number.isFinite(qty) && qty > 0) payout.qty = Math.floor(qty);
      const rate = Number(record.rate);
      if (Number.isFinite(rate) && rate >= 0) payout.rate = rate;
      return payout;
    })
    .filter((item): item is StaffPayout => Boolean(item));
}

export function splitStaffNotes(raw: string | null | undefined): {
  notes: string;
  payouts: StaffPayout[];
} {
  const text = raw ?? '';
  const index = text.indexOf(MARKER);
  if (index === -1) {
    return { notes: text, payouts: [] };
  }
  const notes = text.slice(0, index).trim();
  try {
    return { notes, payouts: parseStaffPayouts(JSON.parse(text.slice(index + MARKER.length))) };
  } catch {
    return { notes, payouts: [] };
  }
}

export function joinStaffNotes(notes: string, payouts: StaffPayout[]) {
  const clean = notes.trim();
  if (payouts.length === 0) return clean;
  return `${clean}${MARKER}${JSON.stringify(payouts)}`;
}

export function staffPayoutTotal(payouts: StaffPayout[] | undefined) {
  return (payouts ?? []).reduce((sum, payout) => sum + payout.amount, 0);
}

export function sortStaffPayouts(payouts: StaffPayout[]) {
  return [...payouts].sort((a, b) => {
    if (a.date === b.date) return b.id.localeCompare(a.id);
    return (b.date || '').localeCompare(a.date || '');
  });
}
