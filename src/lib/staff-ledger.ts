import type { Cloth, Staff, StaffPayout } from '../types';
import { groupClothsForStaffTickets } from './customer-order';
import { getStaffCloths, getStaffPayFields, staffPayPending } from './payments';
import { jobForStaff } from './staff-jobs';
import { clothBillName } from './utils';

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
};

export function piecePending(cloth: Cloth, staff: Staff) {
  const job = jobForStaff(cloth, staff.id, staff.type);
  const amount = job?.amount ?? getStaffPayFields(cloth, staff.type, staff.id).amount;
  return staffPayPending(amount, job?.advance ?? 0, job?.final ?? 0);
}

export function unpaidStaffGroups(staff: Staff, cloths: Cloth[]): StaffUnpaidGroup[] {
  const assigned = getStaffCloths(staff.id, staff.type, cloths);
  return groupClothsForStaffTickets(assigned)
    .map((group) => {
      const primary = group[0]!;
      const job = jobForStaff(primary, staff.id, staff.type);
      const rate = job?.amount ?? getStaffPayFields(primary, staff.type, staff.id).amount;
      const unpaid = group.filter((piece) => piecePending(piece, staff) > 0);
      const pending = unpaid.reduce((sum, piece) => sum + piecePending(piece, staff), 0);
      return {
        key: group.map((item) => item.id).sort().join(','),
        label: clothBillName(primary),
        customerName: primary.customerName?.trim() || 'Customer',
        unpaid,
        unpaidQty: unpaid.length,
        totalQty: group.length,
        paidQty: group.length - unpaid.length,
        rate,
        pending,
        codes: [...new Set(group.map((item) => item.code))],
      };
    })
    .filter((group) => group.unpaidQty > 0);
}

export function payoutProductLine(payout: StaffPayout) {
  if (payout.productLabel && payout.qty) {
    return `${payout.productLabel} × ${payout.qty}`;
  }
  if (payout.productLabel) return payout.productLabel;
  if (payout.note) return payout.note;
  return 'Payout';
}
