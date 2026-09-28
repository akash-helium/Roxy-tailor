import type { Cloth, Staff } from '../types';
import { summarizeCustomerOrder, groupClothsForCustomerBill, customerBillItemLabel, staffTicketTitle } from './customer-order';
import { formatCurrency } from './payments';
import { formatCalendarDate, IN_GROUP_TICKET_LINE } from './utils';
import { listFilledMeasurements, pairMeasurementRows, type MeasurementCell } from './measurements';

export function formatPrintDateTime(date: Date = new Date()) {
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function staffTicketNotes(cloths: Cloth[]) {
  return [...new Set(cloths.map((cloth) => (cloth.notes ?? '').trim()).filter(Boolean))].join(' · ');
}

export const PENDING_TICKET_PREFIX = '!!PENDING ';
export const STAFF_ITEM_PREFIX = '!!ITEM ';

export type StaffTicketView = {
  dateLabel: string;
  orderNumber: string;
  pieceCode: string;
  garmentTitle: string;
  qty: number;
  measurements: MeasurementCell[];
  customerName: string;
  cutterName: string;
  tailorName: string;
  givenDate: string;
  deliveryDate: string;
  cutterBy: string;
  tailorBy: string;
  notes: string;
  inGroup: boolean;
};

export function buildStaffTicketView(
  cloths: Cloth[],
  options?: { cutter?: Staff | null; tailor?: Staff | null },
): StaffTicketView | null {
  const primary = cloths[0];
  if (!primary) return null;

  return {
    dateLabel: primary.givenDate ? formatCalendarDate(primary.givenDate) : '',
    orderNumber: (primary.orderCode || primary.code || '').trim(),
    pieceCode: (primary.code || '').trim(),
    garmentTitle: staffTicketTitle(cloths),
    qty: cloths.length,
    measurements: listFilledMeasurements(
      primary.garmentType,
      primary.measurements ?? {},
      primary.size,
    ),
    customerName: primary.customerName,
    cutterName: options?.cutter?.name?.trim() ?? '',
    tailorName: options?.tailor?.name?.trim() ?? '',
    givenDate: primary.givenDate ? formatCalendarDate(primary.givenDate) : '',
    deliveryDate: primary.deliveryDate ? formatCalendarDate(primary.deliveryDate) : '',
    cutterBy: primary.cutterExpectedDate ? formatCalendarDate(primary.cutterExpectedDate) : '',
    tailorBy: primary.tailorExpectedDate ? formatCalendarDate(primary.tailorExpectedDate) : '',
    notes: staffTicketNotes(cloths),
    inGroup: cloths.some((cloth) => cloth.inGroup),
  };
}

function padSides(left: string, right: string, width = 42) {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(gap)}${right}`;
}

function measurementLine(left: MeasurementCell, right: MeasurementCell | null, width = 42) {
  const col = Math.floor(width / 2);
  const format = (cell: MeasurementCell) => `${cell.label} ${cell.value}`.trim();
  const leftText = format(left).slice(0, col).padEnd(col);
  return right ? `${leftText}${format(right)}`.trimEnd() : leftText.trimEnd();
}

export function buildStaffTicketHeaderLines(cloths: Cloth[]) {
  const view = buildStaffTicketView(cloths);
  if (!view) return [];
  return [padSides(view.dateLabel || '—', view.orderNumber || '—')];
}

export function buildStaffTicketLines(
  cloths: Cloth[],
  options?: { cutter?: Staff | null; tailor?: Staff | null },
) {
  const view = buildStaffTicketView(cloths, options);
  if (!view) return [];

  const lines: string[] = [];
  if (view.garmentTitle) lines.push(`${STAFF_ITEM_PREFIX}${view.garmentTitle}`);
  for (const [left, right] of pairMeasurementRows(view.measurements)) {
    lines.push(measurementLine(left, right));
  }
  lines.push('');
  if (view.customerName) lines.push(view.customerName);
  if (view.qty > 1) lines.push(`Qty ${view.qty}`);
  if (view.cutterName) lines.push(`Cutter: ${view.cutterName}`);
  if (view.tailorName) lines.push(`Tailor: ${view.tailorName}`);
  if (view.deliveryDate) lines.push(`Delivery: ${view.deliveryDate}`);
  if (view.cutterBy) lines.push(`Cutter by: ${view.cutterBy}`);
  if (view.tailorBy) lines.push(`Tailor by: ${view.tailorBy}`);
  if (view.notes) lines.push(`Note: ${view.notes}`);
  if (view.inGroup) {
    lines.push('');
    lines.push(IN_GROUP_TICKET_LINE);
  }
  return lines;
}

export function buildCustomerBillTicketLines(cloths: Cloth[], printedAt = new Date()) {
  const summary = summarizeCustomerOrder(cloths);
  const lines: string[] = [
    `Customer: ${summary.customerName}`,
    `Printed: ${formatPrintDateTime(printedAt)}`,
  ];
  if (summary.givenDate) lines.push(`Order date: ${formatCalendarDate(summary.givenDate)}`);
  if (summary.deliveryDate) lines.push(`Delivery: ${formatCalendarDate(summary.deliveryDate)}`);
  lines.push(`Bill: ${summary.orderCode || summary.codes[0] || '—'}`);
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
