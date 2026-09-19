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

export function filterCloths(
  cloths: Cloth[],
  status: ClothStatusFilter,
  search: string,
): Cloth[] {
  let list = cloths;

  if (status !== 'all') {
    list = list.filter((cloth) => cloth.status === status);
  }

  const query = search.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (cloth) =>
        cloth.code.toLowerCase().includes(query) ||
        cloth.customerName.toLowerCase().includes(query) ||
        cloth.garment.toLowerCase().includes(query) ||
        cloth.fabricColor.toLowerCase().includes(query) ||
        cloth.size.toLowerCase().includes(query),
    );
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
    activeClass: 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm',
    countClass: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'cutting',
    label: 'Cutter',
    activeClass: 'border-amber-300 bg-amber-50 text-amber-800 shadow-sm',
    countClass: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'ready_to_sew',
    label: 'Ready',
    activeClass: 'border-sky-300 bg-sky-50 text-sky-800 shadow-sm',
    countClass: 'bg-sky-100 text-sky-800',
  },
  {
    id: 'sewing',
    label: 'Sewing',
    activeClass: 'border-violet-300 bg-violet-50 text-violet-800 shadow-sm',
    countClass: 'bg-violet-100 text-violet-800',
  },
  {
    id: 'completed',
    label: 'Done',
    activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm',
    countClass: 'bg-emerald-100 text-emerald-800',
  },
];
