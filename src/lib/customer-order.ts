import type { Cloth } from '../types';
import { summarizePayments } from './payments';
import { calendarDayFromIso } from './shop-work';
import { clothBillName, generateOrderCode } from './utils';

/** Groups cloths registered together (same batch, or same customer/date/notes/pay for older rows). */
export function customerOrderKey(cloth: Cloth): string {
  if (cloth.orderBatchId) return `batch:${cloth.orderBatchId}`;
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
  const key = customerOrderKey(cloth);
  const byKey = sortOrderCloths(
    allCloths.filter((item) => customerOrderKey(item) === key),
  );
  if (byKey.length > 1) return byKey;

  const sameCode = sortOrderCloths(
    allCloths.filter((item) => item.code === cloth.code),
  );
  return sameCode.length > 0 ? sameCode : [cloth];
}

export function getOrderGroupId(cloth: Cloth, allCloths: Cloth[]): string {
  const order = getCustomerOrderCloths(cloth, allCloths);
  return sortOrderCloths(order)[0]?.id ?? cloth.id;
}

export function orderIsComplete(cloths: Cloth[]) {
  return cloths.length > 0 && cloths.every((item) => item.status === 'completed');
}

export type OrderBoard = 'all' | 'pending' | 'done' | 'payments' | 'packed';

export function orderIsPacked(cloths: Cloth[]) {
  return cloths.length > 0 && cloths.every((item) => item.packed);
}

export function orderMatchesBoard(orderCloths: Cloth[], board: OrderBoard) {
  if (board === 'all') return orderCloths.length > 0;
  if (board === 'pending') return !orderIsComplete(orderCloths);
  if (board === 'done') return orderIsComplete(orderCloths);
  if (board === 'packed') return orderIsPacked(orderCloths);
  return summarizePayments(orderCloths).totalPending > 0;
}

export function parseOrderBoard(value: string | undefined): OrderBoard | null {
  if (
    value === 'all' ||
    value === 'pending' ||
    value === 'done' ||
    value === 'payments' ||
    value === 'packed'
  ) {
    return value;
  }
  return null;
}

/** Order date used on boards: given date, else the day the row was created. */
export function orderBoardDate(orderCloths: Cloth[]) {
  const given = orderCloths.map((cloth) => (cloth.givenDate ?? '').trim().slice(0, 10)).find(Boolean);
  if (given) return given;
  return calendarDayFromIso(orderCloths[0]?.createdAt);
}

export function orderDeliveryDate(orderCloths: Cloth[]) {
  return orderCloths.map((cloth) => (cloth.deliveryDate ?? '').trim().slice(0, 10)).find(Boolean) ?? '';
}

export function orderMatchesDeliveryDay(orderCloths: Cloth[], day: string) {
  if (!day) return true;
  return orderDeliveryDate(orderCloths) === day;
}

export function orderMatchesDateRange(orderCloths: Cloth[], from: string, to: string) {
  if (!from && !to) return true;
  const day = orderBoardDate(orderCloths);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function formatOrderDateRange(from: string, to: string) {
  if (!from && !to) return 'All dates';
  if (from && to && from !== to) {
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    return `${formatRangeDay(start)} – ${formatRangeDay(end)}`;
  }
  return formatRangeDay(from || to);
}

function formatRangeDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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

/** Unique OR-xxx for this customer order. Persisted codes win; older rows get a stable derived number. */
export function resolveOrderCodeMap(allCloths: Cloth[]): Map<string, string> {
  const groups = new Map<string, Cloth[]>();
  for (const cloth of allCloths) {
    const key = customerOrderKey(cloth);
    const list = groups.get(key);
    if (list) list.push(cloth);
    else groups.set(key, [cloth]);
  }

  const entries = [...groups.entries()]
    .map(([key, items]) => {
      const sorted = sortOrderCloths(items);
      const persisted = sorted.find((item) => item.orderCode)?.orderCode?.trim() ?? '';
      return { key, first: sorted[0]!, persisted };
    })
    .sort(
      (a, b) =>
        a.first.createdAt.localeCompare(b.first.createdAt) ||
        a.key.localeCompare(b.key),
    );

  const used = entries.filter((entry) => entry.persisted).map((entry) => entry.persisted);
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (entry.persisted) {
      map.set(entry.key, entry.persisted);
      continue;
    }
    const next = generateOrderCode(used);
    used.push(next);
    map.set(entry.key, next);
  }
  return map;
}

export function getDisplayOrderCode(cloth: Cloth, allCloths: Cloth[]): string {
  if (cloth.orderCode?.trim()) return cloth.orderCode.trim();
  return resolveOrderCodeMap(allCloths).get(customerOrderKey(cloth)) ?? generateOrderCode([]);
}

export function collectedOrderCodes(allCloths: Cloth[]): string[] {
  return [...new Set(resolveOrderCodeMap(allCloths).values())];
}

export function clothCodeRange(codes: string[]) {
  const unique = [...new Set(codes)].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return unique.join(', ');
  return `${unique[0]} – ${unique[unique.length - 1]}`;
}

export function summarizeCustomerOrder(cloths: Cloth[]) {
  if (cloths.length === 0) {
    return {
      customerName: 'Customer',
      customerPhone: '',
      givenDate: null as string | null,
      deliveryDate: null as string | null,
      notes: '',
      orderCode: '',
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
  const first = cloths[0]!;
  const orderCode =
    cloths.find((item) => item.orderCode?.trim())?.orderCode?.trim() ||
    first.orderCode?.trim() ||
    '';
  return {
    customerName: first.customerName || 'Customer',
    customerPhone: first.customerPhone?.trim() ?? '',
    givenDate: first.givenDate,
    deliveryDate: first.deliveryDate ?? null,
    notes: first.notes?.trim() ?? '',
    orderCode,
    codes: [...new Set(cloths.map((c) => c.code))],
    pieceCount: cloths.length,
    ...payments,
  };
}

export type CustomerBillItem = {
  name: string;
  quantity: number;
  codes: string[];
};

export function groupClothsForCustomerBill(cloths: Cloth[]): CustomerBillItem[] {
  const groups: CustomerBillItem[] = [];
  const indexByName = new Map<string, number>();

  for (const cloth of cloths) {
    const name = clothBillName(cloth);
    const existing = indexByName.get(name);
    if (existing === undefined) {
      indexByName.set(name, groups.length);
      groups.push({ name, quantity: 1, codes: [cloth.code] });
    } else {
      groups[existing]!.quantity += 1;
      if (!groups[existing]!.codes.includes(cloth.code)) {
        groups[existing]!.codes.push(cloth.code);
      }
    }
  }

  return groups;
}

export function customerBillItemLabel(item: CustomerBillItem) {
  return item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name;
}

/** Slip line: Shirt/2 when qty is more than one, matching Shirt/P on the handwritten bill. */
export function customerBillSlipName(item: CustomerBillItem) {
  return item.quantity > 1 ? `${item.name}/${item.quantity}` : item.name;
}

export function customerBillClothNos(item: CustomerBillItem) {
  return item.codes.filter(Boolean).join(', ');
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
    (cloth.notes ?? '').trim(),
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
