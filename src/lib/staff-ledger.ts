import type { Cloth, Staff, StaffPayout } from '../types';
import { groupClothsForStaffTickets } from './customer-order';
import { getStaffCloths, getStaffPayFields, staffPayPending } from './payments';
import { jobForStaff } from './staff-jobs';
import { clothBillName } from './utils';

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export type StaffUnpaidGroup = {
  key: string;
  label: string;
  customerName: string;
  unpaid: Cloth[];
  unpaidQty: number;
  totalQty: number;
  paidQty: number;
  rate: number;
  pending: number;
  codes: string[];
  needsRate: boolean;
};

export type PayoutPiecePay = {
  cloth: Cloth;
  pay: number;
};

export type PayoutAllocation = {
  group: StaffUnpaidGroup;
  amount: number;
  clothIds: string[];
  qty: number;
  rate: number;
  piecePays: PayoutPiecePay[];
};

export function piecePending(cloth: Cloth, staff: Staff) {
  const job = jobForStaff(cloth, staff.id, staff.type);
  const amount = job?.amount ?? getStaffPayFields(cloth, staff.type, staff.id).amount;
  return staffPayPending(amount, job?.advance ?? 0, job?.final ?? 0);
}

export function staffWorkGroups(staff: Staff, cloths: Cloth[]): StaffUnpaidGroup[] {
  const assigned = getStaffCloths(staff.id, staff.type, cloths);
  return groupClothsForStaffTickets(assigned)
    .map((group) => {
      const primary = group[0]!;
      const job = jobForStaff(primary, staff.id, staff.type);
      const rate = job?.amount ?? getStaffPayFields(primary, staff.type, staff.id).amount;
      const needsRate = !(rate > 0);
      const unpaid = needsRate ? [] : group.filter((piece) => piecePending(piece, staff) > 0);
      const pending = unpaid.reduce((sum, piece) => sum + piecePending(piece, staff), 0);
      return {
        key: group.map((item) => item.id).sort().join(','),
        label: clothBillName(primary),
        customerName: primary.customerName?.trim() || 'Customer',
        unpaid,
        unpaidQty: needsRate ? group.length : unpaid.length,
        totalQty: group.length,
        paidQty: needsRate ? 0 : group.length - unpaid.length,
        rate,
        pending: needsRate ? 0 : pending,
        codes: [...new Set(group.map((item) => item.code))],
        needsRate,
      };
    })
    .filter((group) => group.needsRate || group.pending > 0);
}

export function unpaidStaffGroups(staff: Staff, cloths: Cloth[]): StaffUnpaidGroup[] {
  return staffWorkGroups(staff, cloths).filter((group) => !group.needsRate && group.pending > 0);
}

export function workLineQtyCopy(group: StaffUnpaidGroup) {
  return `${group.totalQty} ${group.label} · ${group.paidQty} already paid · ${group.unpaidQty} still due`;
}

export function staffPayRoleLine(type: string, label?: string) {
  if (type === 'cutter') return 'Cutter — pay for cutting';
  if (type === 'tailor') return 'Tailor — pay for stitching';
  const name = label?.trim() || type;
  return `${name} — pay for this work`;
}

export function selectedLineDue(group: StaffUnpaidGroup, payNowQty: number, staff: Staff) {
  const count = Math.max(1, Math.min(Math.floor(payNowQty) || group.unpaidQty, group.unpaidQty));
  const pieces = group.unpaid.slice(0, count);
  return roundMoney(pieces.reduce((sum, piece) => sum + piecePending(piece, staff), 0));
}

export function allocatePayout(
  staff: Staff,
  selected: { group: StaffUnpaidGroup; payNowQty: number }[],
  amount: number,
): PayoutAllocation[] {
  let remaining = roundMoney(Math.max(0, amount));
  const allocations: PayoutAllocation[] = [];

  for (const item of selected) {
    if (remaining <= 0) break;
    if (item.group.needsRate || item.group.unpaidQty <= 0) continue;

    const count = Math.max(1, Math.min(Math.floor(item.payNowQty) || item.group.unpaidQty, item.group.unpaidQty));
    const pieces = item.group.unpaid.slice(0, count);
    const piecePays: PayoutPiecePay[] = [];

    for (const cloth of pieces) {
      if (remaining <= 0) break;
      const pending = piecePending(cloth, staff);
      if (pending <= 0) continue;
      const pay = roundMoney(Math.min(pending, remaining));
      if (pay <= 0) continue;
      piecePays.push({ cloth, pay });
      remaining = roundMoney(remaining - pay);
    }

    if (piecePays.length === 0) continue;
    const lineAmount = roundMoney(piecePays.reduce((sum, row) => sum + row.pay, 0));
    allocations.push({
      group: item.group,
      amount: lineAmount,
      clothIds: piecePays.map((row) => row.cloth.id),
      qty: piecePays.length,
      rate: item.group.rate,
      piecePays,
    });
  }

  return allocations;
}

export function payoutProductLine(payout: StaffPayout) {
  if (payout.productLabel && payout.qty) {
    return `${payout.productLabel} × ${payout.qty}`;
  }
  if (payout.productLabel) return payout.productLabel;
  if (payout.note) return payout.note;
  return 'Payout';
}
