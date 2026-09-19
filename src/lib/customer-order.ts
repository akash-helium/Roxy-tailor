import type { Cloth } from '../types';
import { summarizePayments } from './payments';
import { clothBillName } from './utils';

/** Groups cloths registered together (same customer, date, notes, and per-piece payment split). */
export function customerOrderKey(cloth: Cloth): string {
  const name = cloth.customerName.trim().toLowerCase();
  const given = cloth.givenDate ?? '';
  const notes = (cloth.notes ?? '').trim();
  const pay = `${cloth.totalAmount}|${cloth.discountAmount ?? 0}|${cloth.advanceAmount}`;
  return `${name}|${given}|${notes}|${pay}`;
}

function sortOrderCloths(cloths: Cloth[]) {
  return [...cloths].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      a.code.localeCompare(b.code) ||
      a.id.localeCompare(b.id),
  );
}

export function getCustomerOrderCloths(cloth: Cloth, allCloths: Cloth[]): Cloth[] {
  const sameCode = allCloths.filter((c) => c.code === cloth.code);
  if (sameCode.length > 1) {
    return sortOrderCloths(sameCode);
  }

  const key = customerOrderKey(cloth);
  return sortOrderCloths(allCloths.filter((c) => customerOrderKey(c) === key));
}

export function getOrderGroupId(cloth: Cloth, allCloths: Cloth[]): string {
  const order = getCustomerOrderCloths(cloth, allCloths);
  return sortOrderCloths(order)[0]?.id ?? cloth.id;
}

/** One list row per customer order (not per piece). */
export function getOrderRepresentatives(cloths: Cloth[], allCloths: Cloth[]): Cloth[] {
  const seen = new Set<string>();
  const reps: Cloth[] = [];

  for (const cloth of cloths) {
    const groupId = getOrderGroupId(cloth, allCloths);
    if (seen.has(groupId)) continue;
    seen.add(groupId);
    reps.push(getCustomerOrderCloths(cloth, allCloths)[0] ?? cloth);
  }

  return reps;
}

export function summarizeCustomerOrder(cloths: Cloth[]) {
  if (cloths.length === 0) {
    return {
      customerName: 'Customer',
      givenDate: null as string | null,
      deliveryDate: null as string | null,
      notes: '',
      codes: [] as string[],
      pieceCount: 0,
      totalBill: 0,
      totalDiscount: 0,
      totalAdvance: 0,
      totalPart: 0,
      totalFinal: 0,
      totalPending: 0,
    };
  }

  const payments = summarizePayments(cloths);
  const first = cloths[0];
  return {
    customerName: first.customerName || 'Customer',
    givenDate: first.givenDate,
    deliveryDate: first.deliveryDate ?? null,
    notes: first.notes?.trim() ?? '',
    codes: [...new Set(cloths.map((c) => c.code))],
    pieceCount: cloths.length,
    ...payments,
  };
}

export type CustomerBillItem = {
  name: string;
  quantity: number;
};

export function groupClothsForCustomerBill(cloths: Cloth[]): CustomerBillItem[] {
  const groups: CustomerBillItem[] = [];
  const indexByName = new Map<string, number>();

  for (const cloth of cloths) {
    const name = clothBillName(cloth);
    const existing = indexByName.get(name);
    if (existing === undefined) {
      indexByName.set(name, groups.length);
      groups.push({ name, quantity: 1 });
    } else {
      groups[existing]!.quantity += 1;
    }
  }

  return groups;
}

export function customerBillItemLabel(item: CustomerBillItem) {
  return item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name;
}

function measurementKey(measurements?: Record<string, string>) {
  return Object.entries(measurements ?? {})
    .filter(([, value]) => Boolean(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

/** Same cloth type + size + staff print as one staff ticket (qty 2 shirts → one ticket). */
export function staffTicketGroupKey(cloth: Cloth): string {
  return [
    cloth.garmentType || cloth.garment,
    cloth.size,
    measurementKey(cloth.measurements),
    cloth.cutterId ?? '',
    cloth.tailorId ?? '',
  ].join('|');
}

export function groupClothsForStaffTickets(cloths: Cloth[]): Cloth[][] {
  const groups: Cloth[][] = [];
  const indexByKey = new Map<string, number>();

  for (const cloth of cloths) {
    const key = staffTicketGroupKey(cloth);
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, groups.length);
      groups.push([cloth]);
    } else {
      groups[existing]!.push(cloth);
    }
  }

  return groups;
}

export function staffTicketTitle(cloths: Cloth[]) {
  const primary = cloths[0];
  if (!primary) return '';
  const name = clothBillName(primary);
  return cloths.length > 1 ? `${name} x${cloths.length}` : name;
}

export function orderWorkflowStatus(cloths: Cloth[]): Cloth['status'] {
  if (cloths.length === 0) return 'cutting';
  if (cloths.every((item) => item.status === 'completed')) return 'completed';
  if (cloths.some((item) => item.status === 'cutting')) return 'cutting';
  if (cloths.some((item) => item.status === 'ready_to_sew')) return 'ready_to_sew';
  if (cloths.some((item) => item.status === 'sewing')) return 'sewing';
  return cloths[0]?.status ?? 'cutting';
}
