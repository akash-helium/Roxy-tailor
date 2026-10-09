import type { Cloth, Staff } from '../types';
import { BILL_POLICY_NOTE, SHOP_ADDRESS, SHOP_PHONE } from './app-config';
import {
  summarizeCustomerOrder,
  groupClothsForCustomerBill,
  customerBillSlipName,
  customerBillClothNos,
  staffTicketTitle,
} from './customer-order';
import { formatCurrency } from './payments';
import { formatCalendarDate, IN_GROUP_TICKET_LINE } from './utils';
import { listFilledMeasurements, type MeasurementCell } from './measurements';

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
export const BIG_TICKET_PREFIX = '!!BIG ';
export const BIG_SIDES_PREFIX = '!!BIGSIDES ';

export type StaffTicketView = {
  dateLabel: string;
  orderNumber: string;
  pieceCode: string;
  garmentTitle: string;
  qty: number;
  measurements: MeasurementCell[];
  customerName: string;
  customerPhone: string;
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
    dateLabel: primary.deliveryDate ? formatCalendarDate(primary.deliveryDate) : '',
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
    customerPhone: primary.customerPhone?.trim() ?? '',
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

function measurementLine(cell: MeasurementCell) {
  return `${cell.label} - ${cell.value}`.trim();
}

export const STAFF_SIDES_PREFIX = '!!SIDES ';

export function buildStaffTicketHeaderLines(cloths: Cloth[]) {
  const view = buildStaffTicketView(cloths);
  if (!view) return [];
  return [`${STAFF_SIDES_PREFIX}${view.dateLabel || '—'}\t${view.orderNumber || '—'}`];
}

export function buildStaffTicketLines(
  cloths: Cloth[],
  options?: { cutter?: Staff | null; tailor?: Staff | null },
) {
  const view = buildStaffTicketView(cloths, options);
  if (!view) return [];

  const lines: string[] = [];
  if (view.customerName) lines.push(`${BIG_TICKET_PREFIX}Customer Name - ${view.customerName}`);
  if (view.customerPhone) lines.push(`${BIG_TICKET_PREFIX}Contact No - ${view.customerPhone}`);
  if (view.garmentTitle) lines.push(`${BIG_TICKET_PREFIX}${view.garmentTitle}`);
  for (const cell of view.measurements) {
    lines.push(measurementLine(cell));
  }
  lines.push(`Note - ${view.notes || ''}`);
  if (view.inGroup) {
    lines.push('');
    lines.push(IN_GROUP_TICKET_LINE);
  }
  return lines;
}

export function buildCustomerBillAfterBarcodeLines() {
  return [`Add- ${SHOP_ADDRESS}`, BILL_POLICY_NOTE];
}

export function buildCustomerBillTicketLines(cloths: Cloth[], _printedAt = new Date()) {
  const summary = summarizeCustomerOrder(cloths);
  const orderNo = summary.orderCode || summary.codes[0] || '—';
  const delivery = summary.deliveryDate ? formatCalendarDate(summary.deliveryDate) : '—';
  const lines: string[] = [];

  if (SHOP_PHONE) lines.push(`Contact No - ${SHOP_PHONE}`);
  lines.push(`${STAFF_SIDES_PREFIX}Delivery Date\tOrder No`);
  lines.push(`${BIG_SIDES_PREFIX}${delivery}\t${orderNo}`);
  lines.push('');
  lines.push(`${BIG_TICKET_PREFIX}Name - ${summary.customerName}`);
  if (summary.customerPhone) lines.push(`Contact No - ${summary.customerPhone}`);
  lines.push(`Booking Date - ${summary.givenDate ? formatCalendarDate(summary.givenDate) : '—'}`);
  lines.push('');
  groupClothsForCustomerBill(cloths).forEach((item, index) => {
    const left = `${index + 1}. ${customerBillSlipName(item)}`;
    const right = customerBillClothNos(item);
    if (right) lines.push(`${STAFF_SIDES_PREFIX}${left}\t${right}`);
    else lines.push(left);
  });
  lines.push('-'.repeat(42));
  lines.push(`${STAFF_SIDES_PREFIX}Total Amount\t${formatCurrency(summary.totalBill - summary.totalDiscount)}`);
  lines.push(`${STAFF_SIDES_PREFIX}Advance\t${formatCurrency(summary.totalAdvance)}`);
  if (summary.totalPart > 0) {
    lines.push(`${STAFF_SIDES_PREFIX}Part paid\t${formatCurrency(summary.totalPart)}`);
  }
  lines.push(`${BIG_SIDES_PREFIX}Pending\t${formatCurrency(summary.totalPending)}`);
  if (summary.notes) lines.push(`Note - ${summary.notes}`);
  return lines;
}
