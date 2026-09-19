import type { Cloth, Staff } from '@app/types';
import { clothPaidAmount, clothPendingAmount, getStaffPayFields, staffPayPending } from '@app/lib/payments';

export interface CustomerSummary {
  name: string;
  orderCount: number;
  totalBilled: number;
  totalPaid: number;
  totalPending: number;
  lastOrderDate: string;
  cloths: Cloth[];
}

export interface StaffDetail {
  member: Staff;
  cloths: Cloth[];
  clothCount: number;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
}

export function normalizeCustomerName(name: string) {
  return name.trim() || 'Unknown';
}

export function getClothsByCustomer(customerName: string, cloths: Cloth[]) {
  const key = normalizeCustomerName(customerName);
  return cloths
    .filter((cloth) => normalizeCustomerName(cloth.customerName) === key)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function buildCustomerSummaries(cloths: Cloth[]): CustomerSummary[] {
  const byName = new Map<string, CustomerSummary>();

  for (const cloth of cloths) {
    const key = normalizeCustomerName(cloth.customerName);
    const paid = clothPaidAmount(cloth);
    const pending = clothPendingAmount(cloth);
    const existing = byName.get(key);

    if (!existing) {
      byName.set(key, {
        name: key,
        orderCount: 1,
        totalBilled: cloth.totalAmount,
        totalPaid: paid,
        totalPending: pending,
        lastOrderDate: cloth.updatedAt,
        cloths: [cloth],
      });
      continue;
    }

    existing.orderCount += 1;
    existing.totalBilled += cloth.totalAmount;
    existing.totalPaid += paid;
    existing.totalPending += pending;
    existing.cloths.push(cloth);
    if (cloth.updatedAt > existing.lastOrderDate) {
      existing.lastOrderDate = cloth.updatedAt;
    }
  }

  for (const customer of byName.values()) {
    customer.cloths.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  return [...byName.values()].sort((a, b) => b.lastOrderDate.localeCompare(a.lastOrderDate));
}

export function buildStaffDetails(staff: Staff[], cloths: Cloth[]): StaffDetail[] {
  return staff.map((member) => {
    const assigned =
      member.type === 'cutter'
        ? cloths.filter((cloth) => cloth.cutterId === member.id)
        : member.type === 'tailor'
          ? cloths.filter((cloth) => cloth.tailorId === member.id)
          : [];

    assigned.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const totals = assigned.reduce(
      (acc, cloth) => {
        if (member.type !== 'cutter' && member.type !== 'tailor') return acc;
        const pay = getStaffPayFields(cloth, member.type);
        acc.totalAmount += pay.amount;
        acc.totalPaid += pay.advance + pay.final;
        acc.totalPending += staffPayPending(pay.amount, pay.advance, pay.final);
        return acc;
      },
      { totalAmount: 0, totalPaid: 0, totalPending: 0 },
    );

    return {
      member,
      cloths: assigned,
      clothCount: assigned.length,
      ...totals,
    };
  });
}

export function buildAdminStats(cloths: Cloth[], staff: Staff[]) {
  const customers = buildCustomerSummaries(cloths);
  const staffPaymentDetails = buildStaffDetails(staff, cloths);

  return {
    customerCount: customers.length,
    staffCount: staff.length,
    orderCount: cloths.length,
    totalBilled: cloths.reduce((sum, cloth) => sum + cloth.totalAmount, 0),
    totalCollected: cloths.reduce((sum, cloth) => sum + clothPaidAmount(cloth), 0),
    totalPending: cloths.reduce((sum, cloth) => sum + clothPendingAmount(cloth), 0),
    cutters: staff.filter((member) => member.type === 'cutter').length,
    tailors: staff.filter((member) => member.type === 'tailor').length,
    staffTotalBilled: staffPaymentDetails.reduce((sum, detail) => sum + detail.totalAmount, 0),
    staffTotalPaid: staffPaymentDetails.reduce((sum, detail) => sum + detail.totalPaid, 0),
    staffTotalPending: staffPaymentDetails.reduce((sum, detail) => sum + detail.totalPending, 0),
  };
}
