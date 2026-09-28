import type { Cloth, ClothStatus } from '../types';

export const CLOTH_PAGE_SIZE = 20;

export type ClothStatusFilter = ClothStatus | 'all';

export type ClothListCounts = {
  total: number;
  cutting: number;
  ready: number;
  sewing: number;
  completed: number;
};

export const EMPTY_CLOTH_COUNTS: ClothListCounts = {
  total: 0,
  cutting: 0,
  ready: 0,
  sewing: 0,
  completed: 0,
};

export function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, '\\$&');
}

function compactSearchToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]/g, '');
}

function phoneSearchDigits(value: string) {
  return value.replace(/\D/g, '');
}

/** Tokens for order number (OR-089 / OR089), name, and mobile. */
export function clothSearchTokens(search: string) {
  const raw = search.trim();
  if (!raw) return [];
  const compact = raw.replace(/[\s-]/g, '');
  const tokens = [raw];
  if (compact && compact.toLowerCase() !== raw.toLowerCase()) tokens.push(compact);
  const coded = compact.match(/^([A-Za-z]+)(\d+)$/);
  if (coded) tokens.push(`${coded[1]}-${coded[2]}`);
  const digits = phoneSearchDigits(raw);
  if (digits.length >= 3) tokens.push(digits);
  return [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
}

export function clothMatchesSearch(cloth: Cloth, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const compact = compactSearchToken(query);
  const digits = phoneSearchDigits(query);
  const phone = cloth.customerPhone ?? '';
  const phoneDigits = phoneSearchDigits(phone);
  return (
    cloth.customerName.toLowerCase().includes(query) ||
    cloth.code.toLowerCase().includes(query) ||
    compactSearchToken(cloth.code).includes(compact) ||
    (cloth.orderCode ?? '').toLowerCase().includes(query) ||
    compactSearchToken(cloth.orderCode ?? '').includes(compact) ||
    phone.toLowerCase().includes(query) ||
    (digits.length >= 3 && phoneDigits.includes(digits)) ||
    cloth.garment.toLowerCase().includes(query) ||
    cloth.fabricColor.toLowerCase().includes(query) ||
    cloth.size.toLowerCase().includes(query)
  );
}

export function filterCloths(
  cloths: Cloth[],
  status: ClothStatusFilter,
  search: string,
): Cloth[] {
  let list = cloths;

  if (status !== 'all') {
    list = list.filter((cloth) => cloth.status === status);
  }

  const query = search.trim();
  if (query) {
    list = list.filter((cloth) => clothMatchesSearch(cloth, query));
  }

  return list;
}

export function countClothsByStatus(cloths: Cloth[]): ClothListCounts {
  return {
    total: cloths.length,
    cutting: cloths.filter((c) => c.status === 'cutting').length,
    ready: cloths.filter((c) => c.status === 'ready_to_sew').length,
    sewing: cloths.filter((c) => c.status === 'sewing').length,
    completed: cloths.filter((c) => c.status === 'completed').length,
  };
}

export const CLOTH_FILTER_OPTIONS: {
  id: ClothStatusFilter;
  label: string;
  activeClass: string;
  countClass: string;
}[] = [
  {
    id: 'all',
    label: 'All',
    activeClass: 'border-tab/30 bg-tab/10 text-tab',
    countClass: 'bg-tab/15 text-tab',
  },
  {
    id: 'cutting',
    label: 'Cutter',
    activeClass: 'border-cut/30 bg-cut/10 text-cut',
    countClass: 'bg-cut/15 text-cut',
  },
  {
    id: 'ready_to_sew',
    label: 'Ready',
    activeClass: 'border-ready/30 bg-ready/10 text-ready',
    countClass: 'bg-ready/15 text-ready',
  },
  {
    id: 'sewing',
    label: 'Sewing',
    activeClass: 'border-sew/30 bg-sew/10 text-sew',
    countClass: 'bg-sew/15 text-sew',
  },
  {
    id: 'completed',
    label: 'Done',
    activeClass: 'border-done/30 bg-done/10 text-done',
    countClass: 'bg-done/15 text-done',
  },
];
