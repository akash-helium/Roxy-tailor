import type { Cloth, Staff } from '../types';
import { summarizeCustomerOrder, groupClothsForCustomerBill, customerBillItemLabel, staffTicketTitle } from './customer-order';
import { formatCurrency } from './payments';
import { formatCalendarDate, IN_GROUP_TICKET_LINE, staffClothParts } from './utils';

export function formatPrintDateTime(date: Date = new Date()) {
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildStaffTicketLines(
  cloths: Cloth[],
  options?: { cutter?: Staff | null; tailor?: Staff | null },
) {
  const primary = cloths[0];
  if (!primary) return [];

  const lines: string[] = [primary.customerName, ''];
  const title = staffTicketTitle(cloths);
  const { size } = staffClothParts(primary);
  lines.push(title);
  if (size) lines.push(size);
  lines.push('');
  if (options?.cutter) lines.push(`Cutter: ${options.cutter.name}`);
  if (options?.tailor) lines.push(`Tailor: ${options.tailor.name}`);
  if (primary.givenDate) lines.push(`Order: ${formatCalendarDate(primary.givenDate)}`);
  if (primary.deliveryDate) lines.push(`Delivery: ${formatCalendarDate(primary.deliveryDate)}`);
  if (primary.cutterExpectedDate) {
    lines.push(`Cutter by: ${formatCalendarDate(primary.cutterExpectedDate)}`);
  }
  if (primary.tailorExpectedDate) {
    lines.push(`Tailor by: ${formatCalendarDate(primary.tailorExpectedDate)}`);
  }
  if (primary.notes?.trim()) lines.push(`Notes: ${primary.notes.trim()}`);
  if (cloths.some((cloth) => cloth.inGroup)) {
    lines.push('');
    lines.push(IN_GROUP_TICKET_LINE);
  }
  return lines;
}

export const PENDING_TICKET_PREFIX = '!!PENDING ';

export function buildCustomerBillTicketLines(cloths: Cloth[], printedAt = new Date()) {
  const summary = summarizeCustomerOrder(cloths);
  const lines: string[] = [
    `Customer: ${summary.customerName}`,
    `Printed: ${formatPrintDateTime(printedAt)}`,
  ];
  if (summary.givenDate) lines.push(`Order date: ${formatCalendarDate(summary.givenDate)}`);
  if (summary.deliveryDate) lines.push(`Delivery: ${formatCalendarDate(summary.deliveryDate)}`);
  lines.push(`Bill: ${summary.codes[0] ?? '—'}`);
  lines.push('');
  groupClothsForCustomerBill(cloths).forEach((item, index) => {
    lines.push(`${index + 1}. ${customerBillItemLabel(item)}`);
  });
  lines.push('');
  lines.push(`Total: ${formatCurrency(summary.totalBill - summary.totalDiscount)}`);
  lines.push(`Advance: ${formatCurrency(summary.totalAdvance)}`);
  if (summary.totalPart > 0) {
    lines.push(`Part paid: ${formatCurrency(summary.totalPart)}`);
  }
  lines.push(`${PENDING_TICKET_PREFIX}${formatCurrency(summary.totalPending)}`);
  if (summary.notes) lines.push(`Note: ${summary.notes}`);
  lines.push('');
  lines.push('Thank you. Keep this bill for pickup.');
  return lines;
}
