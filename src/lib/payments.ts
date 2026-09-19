import type { Cloth, DatedAmount, Staff, StaffType } from '../types';
import { staffPayoutTotal } from './staff-payouts';

export function clothNetAmount(cloth: Cloth) {
  return Math.max(0, cloth.totalAmount - (cloth.discountAmount ?? 0));
}

export function clothPartPayments(cloth: Pick<Cloth, 'partPayments'>): DatedAmount[] {
  return (cloth.partPayments ?? []).filter((item) => Number.isFinite(item.amount) && item.amount > 0);
}

export function clothPartPaymentTotal(cloth: Pick<Cloth, 'partPayments'>) {
  return clothPartPayments(cloth).reduce((sum, item) => sum + item.amount, 0);
}

export function clothPaidAmount(cloth: Cloth) {
  return cloth.advanceAmount + clothPartPaymentTotal(cloth) + cloth.finalPaymentAmount;
}

export function clothPendingAmount(cloth: Cloth) {
  return Math.max(0, clothNetAmount(cloth) - clothPaidAmount(cloth));
}

export function staffPayPending(amount: number, advance: number, final: number) {
  return Math.max(0, amount - advance - final);
}

export function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function parseAmount(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parsePartPaymentDrafts(values: { amount: string; date: string }[]) {
  return values
    .map((item) => ({ amount: parseAmount(item.amount), date: item.date.trim() }))
    .filter((item) => item.amount > 0);
}

export function emptyPartPaymentDraft(date = '') {
  return { amount: '', date };
}

export function summarizePayments(cloths: Cloth[]) {
  return cloths.reduce(
    (acc, cloth) => {
      acc.totalBill += cloth.totalAmount;
      acc.totalDiscount += cloth.discountAmount ?? 0;
      acc.totalAdvance += cloth.advanceAmount;
      acc.totalPart += clothPartPaymentTotal(cloth);
      acc.totalFinal += cloth.finalPaymentAmount;
      acc.totalPending += clothPendingAmount(cloth);
      return acc;
    },
    { totalBill: 0, totalDiscount: 0, totalAdvance: 0, totalPart: 0, totalFinal: 0, totalPending: 0 },
  );
}

export function getStaffCloths(staffId: string, staffType: StaffType, cloths: Cloth[]) {
  return cloths.filter((cloth) =>
    staffType === 'cutter' ? cloth.cutterId === staffId : cloth.tailorId === staffId,
  );
}

export function getStaffPayFields(cloth: Cloth, staffType: StaffType) {
  if (staffType === 'cutter') {
    return {
      amount: cloth.cutterPayAmount,
      advance: cloth.cutterPayAdvance,
      final: cloth.cutterPayFinal,
      remarks: cloth.cutterPayRemarks,
    };
  }
  return {
    amount: cloth.tailorPayAmount,
    advance: cloth.tailorPayAdvance,
    final: cloth.tailorPayFinal,
    remarks: cloth.tailorPayRemarks,
  };
}

export function summarizeStaffPayments(staff: Staff, cloths: Cloth[]) {
  const assigned = getStaffCloths(staff.id, staff.type, cloths);
  const agreed = assigned.reduce(
    (acc, cloth) => {
      const pay = getStaffPayFields(cloth, staff.type);
      acc.clothCount += 1;
      acc.totalAmount += pay.amount;
      acc.totalAdvance += pay.advance;
      acc.totalFinal += pay.final;
      return acc;
    },
    { clothCount: 0, totalAmount: 0, totalAdvance: 0, totalFinal: 0 },
  );
  const ledgerPaid = staffPayoutTotal(staff.payouts);
  const paid = ledgerPaid > 0 ? ledgerPaid : agreed.totalAdvance + agreed.totalFinal;
  return {
    ...agreed,
    ledgerPaid,
    paid,
    totalPending: Math.max(0, agreed.totalAmount - paid),
  };
}

export type StaffPayInput = {
  amount: number;
  advance: number;
  final: number;
  remarks: string;
};

export function staffPayPatch(staffType: StaffType, input: StaffPayInput) {
  if (staffType === 'cutter') {
    return {
      cutterPayAmount: input.amount,
      cutterPayAdvance: input.advance,
      cutterPayFinal: input.final,
      cutterPayRemarks: input.remarks,
    };
  }
  return {
    tailorPayAmount: input.amount,
    tailorPayAdvance: input.advance,
    tailorPayFinal: input.final,
    tailorPayRemarks: input.remarks,
  };
}

export const EMPTY_STAFF_PAY: StaffPayInput = {
  amount: 0,
  advance: 0,
  final: 0,
  remarks: '',
};
